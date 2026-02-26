import base64
import calendar
import io
import json
import re
from datetime import date, datetime
from importlib import import_module
from typing import Any

import streamlit as st

EXTRACTION_PROMPT = (
    'You are an academic schedule extraction assistant. Extract ALL time-sensitive events from this '
    'syllabus and return ONLY valid JSON in this schema: { "course_name": string, "instructor": '
    'string, "semester": string, "semester_start": "YYYY-MM-DD", "semester_end": "YYYY-MM-DD", '
    '"events": [ { "id": integer, "category": "class" | "exam" | "office_hours" | "assignment" '
    '| "project" | "other", "title": string, "date": "YYYY-MM-DD" or null if recurring, '
    '"recurring": boolean, "recurrence_rule": string or null, "time_start": "HH:MM" or null, '
    '"time_end": "HH:MM" or null, "location": string or null, "notes": string or null } ] }. '
    'If any field is missing from the syllabus use null. Do not invent information.'
)

CATEGORY_COLORS = {
    "exam": "#d73027",
    "class": "#2c7bb6",
    "assignment": "#f57c00",
    "project": "#f57c00",
    "office_hours": "#1a9850",
    "other": "#6e6e6e",
}

CATEGORY_HEX = {
    "exam": "#d73027",
    "class": "#2c7bb6",
    "assignment": "#f57c00",
    "project": "#f57c00",
    "office_hours": "#1a9850",
    "other": "#6e6e6e",
}

WEEKDAY_MAP = {
    "MO": "Mon",
    "TU": "Tue",
    "WE": "Wed",
    "TH": "Thu",
    "FR": "Fri",
    "SA": "Sat",
    "SU": "Sun",
    "MONDAY": "Mon",
    "TUESDAY": "Tue",
    "WEDNESDAY": "Wed",
    "THURSDAY": "Thu",
    "FRIDAY": "Fri",
    "SATURDAY": "Sat",
    "SUNDAY": "Sun",
    "MON": "Mon",
    "TUE": "Tue",
    "WED": "Wed",
    "THU": "Thu",
    "FRI": "Fri",
    "SAT": "Sat",
    "SUN": "Sun",
}

EVENT_COLUMNS = [
    "id",
    "category",
    "title",
    "date",
    "recurring",
    "recurrence_rule",
    "time_start",
    "time_end",
    "location",
    "notes",
]


def load_reportlab() -> dict[str, Any]:
    try:
        colors_module = import_module("reportlab.lib.colors")
        pagesizes_module = import_module("reportlab.lib.pagesizes")
        styles_module = import_module("reportlab.lib.styles")
        platypus_module = import_module("reportlab.platypus")
    except ModuleNotFoundError as error:
        raise RuntimeError("Missing dependency 'reportlab'. Install it with: pip3 install reportlab") from error

    return {
        "colors": colors_module,
        "letter": pagesizes_module.letter,
        "getSampleStyleSheet": styles_module.getSampleStyleSheet,
        "PageBreak": platypus_module.PageBreak,
        "Paragraph": platypus_module.Paragraph,
        "SimpleDocTemplate": platypus_module.SimpleDocTemplate,
        "Spacer": platypus_module.Spacer,
        "Table": platypus_module.Table,
        "TableStyle": platypus_module.TableStyle,
    }


def init_state() -> None:
    if "schedule_data" not in st.session_state:
        st.session_state.schedule_data = {
            "course_name": None,
            "instructor": None,
            "semester": None,
            "semester_start": None,
            "semester_end": None,
            "events": [],
        }
    if "events_table" not in st.session_state:
        st.session_state.events_table = []
    if "generated_pdf" not in st.session_state:
        st.session_state.generated_pdf = None


def coerce_event(event: dict[str, Any], index: int) -> dict[str, Any]:
    safe_event = {col: event.get(col) for col in EVENT_COLUMNS}
    safe_event["id"] = safe_event["id"] if safe_event["id"] is not None else index + 1
    safe_event["category"] = safe_event["category"] or "other"
    safe_event["title"] = safe_event["title"] or "Untitled event"
    safe_event["recurring"] = bool(safe_event["recurring"])
    return safe_event


def parse_json_response(raw_text: str) -> dict[str, Any]:
    candidate = raw_text.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?", "", candidate).strip()
        candidate = re.sub(r"```$", "", candidate).strip()
    data = json.loads(candidate)
    if "events" not in data or not isinstance(data["events"], list):
        raise ValueError("Claude response JSON does not include an events array.")
    data["events"] = [coerce_event(event, idx) for idx, event in enumerate(data["events"])]
    return data


def extract_schedule_with_claude(pdf_bytes: bytes) -> dict[str, Any]:
    api_key = st.secrets.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("Missing ANTHROPIC_API_KEY in Streamlit secrets.")

    try:
        anthropic_module = import_module("anthropic")
        anthropic_client = anthropic_module.Anthropic
    except ModuleNotFoundError as error:
        raise RuntimeError("Missing dependency 'anthropic'. Install it with: pip3 install anthropic") from error

    client = anthropic_client(api_key=api_key)
    encoded_pdf = base64.b64encode(pdf_bytes).decode("utf-8")

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": encoded_pdf,
                        },
                    },
                    {"type": "text", "text": EXTRACTION_PROMPT},
                ],
            }
        ],
    )
    text_blocks = [block.text for block in response.content if getattr(block, "type", "") == "text"]
    if not text_blocks:
        raise ValueError("Claude returned no text content.")
    return parse_json_response("\n".join(text_blocks))


def parse_date_safe(value: Any) -> date | None:
    if not value or value == "None":
        return None
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_time_safe(value: Any) -> str:
    if not value or value == "None":
        return ""
    return str(value)


def detect_weekdays(event: dict[str, Any]) -> list[str]:
    text = " ".join(
        [
            str(event.get("recurrence_rule") or ""),
            str(event.get("notes") or ""),
            str(event.get("title") or ""),
        ]
    ).upper()
    found: list[str] = []
    for token, label in WEEKDAY_MAP.items():
        if re.search(rf"\b{re.escape(token)}\b", text) and label not in found:
            found.append(label)
    byday_match = re.search(r"BYDAY=([A-Z,]+)", text)
    if byday_match:
        for token in byday_match.group(1).split(","):
            label = WEEKDAY_MAP.get(token)
            if label and label not in found:
                found.append(label)
    return found


def build_weekly_grid(events: list[dict[str, Any]]) -> Any:
    reportlab = load_reportlab()
    colors = reportlab["colors"]
    Table = reportlab["Table"]
    TableStyle = reportlab["TableStyle"]

    recurring = [
        event
        for event in events
        if bool(event.get("recurring")) and event.get("category") in {"class", "office_hours"}
    ]
    header = ["Time", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    if not recurring:
        data = [header, ["No recurring class/office-hours events found.", "", "", "", "", "", "", ""]]
        table = Table(data, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("SPAN", (0, 1), (-1, 1)),
                ]
            )
        )
        return table

    time_slots: dict[str, dict[str, list[str]]] = {}
    for event in recurring:
        time_label = f"{parse_time_safe(event.get('time_start'))}-{parse_time_safe(event.get('time_end'))}".strip("-")
        time_label = time_label or "Time not specified"
        weekdays = detect_weekdays(event)
        if not weekdays and event.get("date"):
            parsed = parse_date_safe(event.get("date"))
            if parsed:
                weekdays = [calendar.day_abbr[parsed.weekday()]]
        if time_label not in time_slots:
            time_slots[time_label] = {day: [] for day in header[1:]}
        for day in weekdays:
            title = str(event.get("title") or "")
            loc = str(event.get("location") or "")
            desc = f"{title} ({loc})" if loc else title
            time_slots[time_label][day].append(desc)

    rows = [header]
    for time_label in sorted(time_slots.keys()):
        row = [time_label]
        for day in header[1:]:
            row.append("\n".join(time_slots[time_label][day]))
        rows.append(row)

    table = Table(rows, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def month_range(start: date, end: date) -> list[tuple[int, int]]:
    months: list[tuple[int, int]] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        months.append((year, month))
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
    return months


def category_priority(category: str) -> int:
    order = {"exam": 0, "class": 1, "assignment": 2, "project": 2, "office_hours": 3, "other": 4}
    return order.get(category, 4)


def build_month_page(events: list[dict[str, Any]], year: int, month: int, styles: Any) -> list[Any]:
    reportlab = load_reportlab()
    colors = reportlab["colors"]
    Paragraph = reportlab["Paragraph"]
    Spacer = reportlab["Spacer"]
    Table = reportlab["Table"]
    TableStyle = reportlab["TableStyle"]

    month_events: dict[int, list[dict[str, Any]]] = {}
    for event in events:
        event_date = parse_date_safe(event.get("date"))
        if event_date and event_date.year == year and event_date.month == month:
            month_events.setdefault(event_date.day, []).append(event)

    cal = calendar.Calendar(firstweekday=0)
    weeks = cal.monthdayscalendar(year, month)
    data: list[list[Any]] = [["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]]

    for week in weeks:
        row: list[Any] = []
        for day in week:
            if day == 0:
                row.append("")
                continue
            day_events = sorted(month_events.get(day, []), key=lambda e: category_priority(str(e.get("category"))))
            if not day_events:
                row.append(str(day))
                continue

            lead_category = str(day_events[0].get("category") or "other")
            day_color = CATEGORY_HEX.get(lead_category, CATEGORY_HEX["other"])
            lines = [f"<font color='{day_color}'><b>{day}</b></font>"]
            for event in day_events[:3]:
                category = str(event.get("category") or "other")
                color = CATEGORY_HEX.get(category, CATEGORY_HEX["other"])
                title = str(event.get("title") or "Event")
                lines.append(f"<font color='{color}' size='8'>• {title}</font>")
            if len(day_events) > 3:
                lines.append("<font size='8'>...</font>")
            row.append(Paragraph("<br/>".join(lines), styles["BodyText"]))
        data.append(row)

    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ROWHEIGHT", (0, 1), (-1, -1), 80),
            ]
        )
    )

    return [Paragraph(f"{calendar.month_name[month]} {year}", styles["Heading2"]), Spacer(1, 8), table]


def build_chronological_table(events: list[dict[str, Any]]) -> Any:
    reportlab = load_reportlab()
    colors = reportlab["colors"]
    Table = reportlab["Table"]
    TableStyle = reportlab["TableStyle"]

    non_recurring = [
        event for event in events if not bool(event.get("recurring")) and parse_date_safe(event.get("date")) is not None
    ]
    non_recurring.sort(key=lambda event: (str(event.get("date")), str(event.get("time_start") or "")))

    data = [["Date", "Time", "Category", "Title", "Location", "Notes"]]
    for event in non_recurring:
        start = parse_time_safe(event.get("time_start"))
        end = parse_time_safe(event.get("time_end"))
        time_label = f"{start}-{end}".strip("-")
        data.append(
            [
                str(event.get("date") or ""),
                time_label,
                str(event.get("category") or "other"),
                str(event.get("title") or ""),
                str(event.get("location") or ""),
                str(event.get("notes") or ""),
            ]
        )

    if len(data) == 1:
        data.append(["No non-recurring dated events found.", "", "", "", "", ""])

    table = Table(data, repeatRows=1, colWidths=[70, 55, 70, 130, 95, 120])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def resolve_semester_range(schedule_data: dict[str, Any], events: list[dict[str, Any]]) -> tuple[date, date]:
    start = parse_date_safe(schedule_data.get("semester_start"))
    end = parse_date_safe(schedule_data.get("semester_end"))
    dated_events = [parse_date_safe(event.get("date")) for event in events]
    dated_events = [event_date for event_date in dated_events if event_date is not None]

    if start is None and dated_events:
        start = min(dated_events)
    if end is None and dated_events:
        end = max(dated_events)
    if start is None:
        start = date.today().replace(day=1)
    if end is None:
        end = start
    if end < start:
        end = start
    return start, end


def generate_schedule_pdf(schedule_data: dict[str, Any], events: list[dict[str, Any]]) -> bytes:
    reportlab = load_reportlab()
    SimpleDocTemplate = reportlab["SimpleDocTemplate"]
    letter = reportlab["letter"]
    getSampleStyleSheet = reportlab["getSampleStyleSheet"]
    Paragraph = reportlab["Paragraph"]
    Spacer = reportlab["Spacer"]
    PageBreak = reportlab["PageBreak"]

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=24, rightMargin=24, topMargin=24, bottomMargin=24)
    styles = getSampleStyleSheet()
    story: list[Any] = []

    course_name = schedule_data.get("course_name") or "Unknown Course"
    semester = schedule_data.get("semester") or "Unknown Semester"
    instructor = schedule_data.get("instructor") or "Unknown Instructor"

    story.append(Paragraph("Syllabus Schedule Builder", styles["Title"]))
    story.append(Paragraph(f"Course: {course_name}", styles["Heading3"]))
    story.append(Paragraph(f"Instructor: {instructor}", styles["Heading3"]))
    story.append(Paragraph(f"Semester: {semester}", styles["Heading3"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Weekly Recurring Schedule", styles["Heading2"]))
    story.append(Spacer(1, 6))
    story.append(build_weekly_grid(events))

    start, end = resolve_semester_range(schedule_data, events)
    for year, month in month_range(start, end):
        story.append(PageBreak())
        story.append(Paragraph("Month-by-Month Calendar", styles["Heading1"]))
        story.append(Spacer(1, 8))
        story.extend(build_month_page(events, year, month, styles))

    story.append(PageBreak())
    story.append(Paragraph("Chronological Table", styles["Heading1"]))
    story.append(Spacer(1, 8))
    story.append(build_chronological_table(events))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()


def load_extraction_into_state(data: dict[str, Any]) -> None:
    st.session_state.schedule_data = {
        "course_name": data.get("course_name"),
        "instructor": data.get("instructor"),
        "semester": data.get("semester"),
        "semester_start": data.get("semester_start"),
        "semester_end": data.get("semester_end"),
        "events": [coerce_event(event, idx) for idx, event in enumerate(data.get("events", []))],
    }
    st.session_state.events_table = st.session_state.schedule_data["events"]
    st.session_state.generated_pdf = None


def ui() -> None:
    st.set_page_config(page_title="Syllabus Schedule Builder", layout="wide")
    st.title("Syllabus Schedule Builder")
    st.write("Upload a syllabus PDF, extract schedule events with Claude, review/edit, and generate a semester PDF.")

    init_state()

    uploaded_file = st.file_uploader("Upload syllabus PDF", type=["pdf"])

    if uploaded_file is not None:
        if st.button("Extract Schedule with Claude", type="primary"):
            try:
                with st.spinner("Claude is extracting schedule data from your syllabus..."):
                    extracted = extract_schedule_with_claude(uploaded_file.read())
                load_extraction_into_state(extracted)
                st.success("Schedule extracted. Review and edit events below.")
            except Exception as error:
                st.error(f"Extraction failed: {error}")

    with st.expander("Course Details", expanded=True):
        col1, col2, col3 = st.columns(3)
        with col1:
            st.session_state.schedule_data["course_name"] = st.text_input(
                "Course Name",
                value=st.session_state.schedule_data.get("course_name") or "",
            )
            st.session_state.schedule_data["semester"] = st.text_input(
                "Semester",
                value=st.session_state.schedule_data.get("semester") or "",
            )
        with col2:
            st.session_state.schedule_data["instructor"] = st.text_input(
                "Instructor",
                value=st.session_state.schedule_data.get("instructor") or "",
            )
            st.session_state.schedule_data["semester_start"] = st.text_input(
                "Semester Start (YYYY-MM-DD)",
                value=st.session_state.schedule_data.get("semester_start") or "",
            )
        with col3:
            st.session_state.schedule_data["semester_end"] = st.text_input(
                "Semester End (YYYY-MM-DD)",
                value=st.session_state.schedule_data.get("semester_end") or "",
            )

    st.subheader("Extracted Events (Editable)")
    edited_events = st.data_editor(
        st.session_state.events_table,
        use_container_width=True,
        num_rows="dynamic",
        column_config={
            "category": st.column_config.SelectboxColumn(
                "Category",
                options=["class", "exam", "office_hours", "assignment", "project", "other"],
            ),
            "recurring": st.column_config.CheckboxColumn("Recurring"),
        },
    )
    st.session_state.events_table = [coerce_event(dict(event), idx) for idx, event in enumerate(edited_events)]

    if st.button("Generate Schedule"):
        try:
            pdf_bytes = generate_schedule_pdf(st.session_state.schedule_data, st.session_state.events_table)
            st.session_state.generated_pdf = pdf_bytes
            st.success("Schedule PDF generated.")
        except Exception as error:
            st.error(f"PDF generation failed: {error}")

    if st.session_state.generated_pdf is not None:
        st.download_button(
            label="Download Semester Schedule PDF",
            data=st.session_state.generated_pdf,
            file_name="semester_schedule.pdf",
            mime="application/pdf",
        )


if __name__ == "__main__":
    ui()
