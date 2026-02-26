"use client";
import { useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT = {
  class:        { bg: "#1a3a5c", light: "#e8f0f7", text: "#1a3a5c", label: "Class" },
  exam:         { bg: "#8b1a1a", light: "#f7e8e8", text: "#8b1a1a", label: "Exam" },
  office_hours: { bg: "#1a5c3a", light: "#e8f7ee", text: "#1a5c3a", label: "Office Hours" },
  assignment:   { bg: "#7a4a00", light: "#f7f0e0", text: "#7a4a00", label: "Assignment" },
  project:      { bg: "#4a0060", light: "#f3e8f7", text: "#4a0060", label: "Project" },
  other:        { bg: "#3a3a3a", light: "#efefef", text: "#3a3a3a", label: "Other" },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const DEMO = {
  course_name: "ARC 410: Critical Theory in Architecture",
  instructor: "Prof. Martinez",
  semester: "Spring 2026",
  semester_start: "2026-01-20",
  semester_end: "2026-05-10",
  events: [
    { id:1,  category:"class",        title:"Lecture",                        recurring:true,  recurrence_rule:"every Monday Wednesday", date:null,         time_start:"10:00", time_end:"11:15", location:"Slocum 202",    notes:null },
    { id:2,  category:"office_hours", title:"Prof. Martinez Office Hours",     recurring:true,  recurrence_rule:"every Thursday",         date:null,         time_start:"14:00", time_end:"16:00", location:"Slocum 310",    notes:null },
    { id:3,  category:"exam",         title:"Midterm Exam",                    recurring:false, recurrence_rule:null,                     date:"2026-03-04", time_start:"10:00", time_end:"11:15", location:"Slocum 202",    notes:"Covers weeks 1–6" },
    { id:4,  category:"assignment",   title:"Essay 1: Spatial Politics",       recurring:false, recurrence_rule:null,                     date:"2026-02-10", time_start:"23:59", time_end:null,    location:null,            notes:"Submit via Blackboard" },
    { id:5,  category:"project",      title:"Design Studio Project — Draft",   recurring:false, recurrence_rule:null,                     date:"2026-03-25", time_start:"23:59", time_end:null,    location:null,            notes:null },
    { id:6,  category:"assignment",   title:"Reading Response #3",             recurring:false, recurrence_rule:null,                     date:"2026-02-24", time_start:"23:59", time_end:null,    location:null,            notes:null },
    { id:7,  category:"exam",         title:"Final Exam",                      recurring:false, recurrence_rule:null,                     date:"2026-05-06", time_start:"10:30", time_end:"12:30", location:"Slocum 202",    notes:"Comprehensive" },
    { id:8,  category:"project",      title:"Final Project Submission",        recurring:false, recurrence_rule:null,                     date:"2026-04-28", time_start:"23:59", time_end:null,    location:null,            notes:"Full portfolio + written component" },
    { id:9,  category:"other",        title:"Spring Break — No Class",         recurring:false, recurrence_rule:null,                     date:"2026-03-16", time_start:null,    time_end:null,    location:null,            notes:"March 16–20" },
    { id:10, category:"assignment",   title:"Essay 2: Post-Capitalist Urbanism",recurring:false,recurrence_rule:null,                     date:"2026-04-07", time_start:"23:59", time_end:null,    location:null,            notes:null },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s + "T12:00:00");
  return isNaN(d) ? null : d;
}
function fmt12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m)    { return new Date(y, m, 1).getDay(); }

function Badge({ cat }) {
  const c = CAT[cat] || CAT.other;
  return (
    <span style={{ background: c.light, color: c.text, fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:2 }}>
      {c.label}
    </span>
  );
}

// ─── Upload ──────────────────────────────────────────────────────────────────

function UploadStep({ onExtract }) {
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [drag, setDrag]       = useState(false);

  const pick = (f) => {
    if (f?.type === "application/pdf") { setFile(f); setError(null); }
    else setError("Please upload a PDF.");
  };

  const run = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const buf  = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);

      const res  = await fetch("/api/extract", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ base64: b64 }) });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok || json.error) throw new Error(json.error || "API error");
      onExtract(json.data);
    } catch (e) {
      setError("Extraction failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#fff", padding:24 }}>
      <div style={{ maxWidth:520, width:"100%" }}>

        {/* Hero */}
        <div style={{ marginBottom:52 }}>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, letterSpacing:"0.25em", textTransform:"uppercase", color:"#aaa", marginBottom:14 }}>
            Academic Tools
          </div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:52, fontWeight:900, margin:0, lineHeight:1.05, color:"#111", letterSpacing:"-0.02em" }}>
            Syllabus<br/>
            <span style={{ color:"#bbb", fontWeight:400 }}>Schedule</span><br/>
            Builder
          </h1>
          <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, color:"#666", marginTop:20, lineHeight:1.65, maxWidth:400 }}>
            Upload your course syllabus and instantly get a full semester schedule — organized by week, month, and deadline.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
          onClick={() => document.getElementById("fi").click()}
          style={{
            border:`2px dashed ${drag ? "#111" : file ? "#1a5c3a" : "#d8d8d8"}`,
            borderRadius:6, padding:"44px 32px", textAlign:"center", cursor:"pointer",
            background: drag ? "#f5f5f5" : file ? "#f0f7f2" : "#fafafa",
            transition:"all 0.2s", marginBottom:20,
          }}
        >
          <input id="fi" type="file" accept=".pdf" style={{ display:"none" }} onChange={e => pick(e.target.files[0])} />
          <div style={{ fontSize:36, marginBottom:14 }}>{file ? "📄" : "☁"}</div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, color: file ? "#1a5c3a" : "#444", fontWeight:600 }}>
            {file ? file.name : "Drop your syllabus PDF here"}
          </div>
          {!file && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#bbb", marginTop:6 }}>or click to browse</div>}
        </div>

        {error && (
          <div style={{ background:"#fff0f0", border:"1px solid #f7c5c5", borderRadius:4, padding:"12px 16px", fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#8b1a1a", marginBottom:16 }}>
            {error}
          </div>
        )}

        <button
          onClick={run}
          disabled={!file || loading}
          style={{
            width:"100%", padding:"15px 24px",
            background: file && !loading ? "#111" : "#e5e5e5",
            color: file && !loading ? "#fff" : "#aaa",
            border:"none", borderRadius:4, fontFamily:"'DM Sans',sans-serif",
            fontSize:15, fontWeight:700, letterSpacing:"0.04em",
            cursor: file && !loading ? "pointer" : "not-allowed", transition:"background 0.2s",
          }}
        >
          {loading ? "Extracting schedule…" : "Extract Schedule →"}
        </button>

        {/* Demo */}
        <div style={{ textAlign:"center", marginTop:24 }}>
          <button
            onClick={() => onExtract(DEMO)}
            style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#aaa", textDecoration:"underline" }}
          >
            View demo without uploading
          </button>
        </div>

        {/* Legend */}
        <div style={{ marginTop:52, paddingTop:24, borderTop:"1px solid #f0f0f0" }}>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#ccc", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>
            What gets extracted
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {Object.entries(CAT).map(([k, v]) => (
              <span key={k} style={{ background:v.light, color:v.text, fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:2 }}>
                {v.label}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Review ──────────────────────────────────────────────────────────────────

function ReviewStep({ data, onConfirm, onBack }) {
  const [events, setEvents] = useState(data.events);
  const [editing, setEditing] = useState(null);

  const upd = (id, f, v) => setEvents(p => p.map(e => e.id === id ? { ...e, [f]: v } : e));
  const del = (id) => setEvents(p => p.filter(e => e.id !== id));

  return (
    <div style={{ maxWidth:1000, margin:"0 auto", padding:"48px 24px" }}>

      <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#aaa", padding:0, marginBottom:20 }}>
        ← Back
      </button>

      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:20, marginBottom:36, paddingBottom:28, borderBottom:"2px solid #111" }}>
        <div>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:32, margin:0, color:"#111", fontWeight:700 }}>
            {data.course_name || "Course Schedule"}
          </h2>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"#888", marginTop:8, display:"flex", gap:20, flexWrap:"wrap" }}>
            {data.instructor && <span>👤 {data.instructor}</span>}
            {data.semester    && <span>📅 {data.semester}</span>}
          </div>
        </div>
        <button
          onClick={() => onConfirm({ ...data, events })}
          style={{ padding:"13px 28px", background:"#111", color:"#fff", border:"none", borderRadius:4, fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:700, cursor:"pointer", letterSpacing:"0.03em" }}
        >
          Generate Schedule →
        </button>
      </div>

      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#aaa", marginBottom:16 }}>
        {events.length} events extracted — click Edit to fix any mistakes
      </div>

      <div style={{ border:"1px solid #e8e8e8", borderRadius:6, overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'DM Sans',sans-serif", fontSize:13 }}>
          <thead>
            <tr style={{ background:"#f7f7f7", borderBottom:"1px solid #e8e8e8" }}>
              {["Category","Title","Date","Time","Location","Notes",""].map(h => (
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:"#666", fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => {
              const isEd = editing === ev.id;
              return (
                <tr key={ev.id} style={{ borderBottom:"1px solid #f4f4f4", background: i%2===0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding:"10px 14px" }}>
                    {isEd ? (
                      <select value={ev.category} onChange={e => upd(ev.id,"category",e.target.value)} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, border:"1px solid #ddd", borderRadius:2, padding:"3px 6px" }}>
                        {Object.keys(CAT).map(k => <option key={k} value={k}>{CAT[k].label}</option>)}
                      </select>
                    ) : <Badge cat={ev.category} />}
                  </td>
                  <td style={{ padding:"10px 14px", fontWeight:500, color:"#222" }}>
                    {isEd
                      ? <input value={ev.title||""} onChange={e=>upd(ev.id,"title",e.target.value)} style={{ width:"100%", border:"1px solid #ddd", borderRadius:2, padding:"4px 6px", fontFamily:"'DM Sans',sans-serif", fontSize:13 }} />
                      : ev.title}
                  </td>
                  <td style={{ padding:"10px 14px", color:"#666", whiteSpace:"nowrap" }}>
                    {ev.recurring
                      ? <span style={{ fontStyle:"italic", color:"#aaa" }}>{ev.recurrence_rule || "Recurring"}</span>
                      : isEd
                        ? <input type="date" value={ev.date||""} onChange={e=>upd(ev.id,"date",e.target.value)} style={{ border:"1px solid #ddd", borderRadius:2, padding:"3px 6px" }} />
                        : ev.date || "—"}
                  </td>
                  <td style={{ padding:"10px 14px", color:"#666", whiteSpace:"nowrap" }}>
                    {ev.time_start ? `${fmt12(ev.time_start)}${ev.time_end ? " – "+fmt12(ev.time_end) : ""}` : "—"}
                  </td>
                  <td style={{ padding:"10px 14px", color:"#888" }}>{ev.location || "—"}</td>
                  <td style={{ padding:"10px 14px", color:"#aaa", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.notes || "—"}</td>
                  <td style={{ padding:"10px 14px", whiteSpace:"nowrap" }}>
                    <button onClick={() => setEditing(isEd ? null : ev.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#888", fontSize:12, marginRight:8 }}>{isEd ? "✓ Done" : "Edit"}</button>
                    <button onClick={() => del(ev.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#cc4444", fontSize:12 }}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Month Calendar ───────────────────────────────────────────────────────────

function MonthCal({ year, month, events }) {
  const days   = getDaysInMonth(year, month);
  const first  = getFirstDay(year, month);
  const cells  = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = {};
  events.forEach(ev => {
    if (!ev.date) return;
    const d = parseDate(ev.date);
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) return;
    const day = d.getDate();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(ev);
  });

  if (!Object.keys(byDay).length) return null;

  return (
    <div style={{ marginBottom:48 }}>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:"#111", marginBottom:16 }}>
        {MONTHS[month]} {year}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", border:"1px solid #e8e8e8", borderRadius:6, overflow:"hidden" }}>
        {DAYS.map(d => (
          <div key={d} style={{ padding:"8px 0", textAlign:"center", fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, color:"#888", letterSpacing:"0.1em", textTransform:"uppercase", background:"#f7f7f7", borderBottom:"1px solid #e8e8e8" }}>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const evs = day ? (byDay[day] || []) : [];
          return (
            <div key={i} style={{
              minHeight:72, padding:6,
              background: day ? "#fff" : "#fafafa",
              borderRight: (i+1)%7===0 ? "none" : "1px solid #f0f0f0",
              borderBottom: i < cells.length-7 ? "1px solid #f0f0f0" : "none",
            }}>
              {day && (
                <>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color: evs.length ? "#111" : "#ccc", fontWeight: evs.length ? 700 : 400, marginBottom:3 }}>{day}</div>
                  {evs.slice(0,2).map((ev,j) => {
                    const c = CAT[ev.category] || CAT.other;
                    return (
                      <div key={j} title={ev.title} style={{ background:c.bg, color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:10, padding:"2px 5px", borderRadius:2, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:"1.4" }}>
                        {ev.title}
                      </div>
                    );
                  })}
                  {evs.length > 2 && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#aaa" }}>+{evs.length-2} more</div>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weekly Block ─────────────────────────────────────────────────────────────

function WeeklyBlock({ events }) {
  const recurring = events.filter(e => e.recurring && e.recurrence_rule);
  if (!recurring.length) return null;

  const order = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const byDay = {};
  recurring.forEach(ev => {
    order.forEach(d => {
      if ((ev.recurrence_rule||"").toLowerCase().includes(d.toLowerCase())) {
        if (!byDay[d]) byDay[d] = [];
        byDay[d].push(ev);
      }
    });
  });

  const active = order.filter(d => byDay[d]);
  if (!active.length) return null;

  return (
    <div style={{ marginBottom:56 }}>
      <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:"#111", marginBottom:24 }}>Weekly Schedule</h3>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(active.length,5)},1fr)`, gap:12 }}>
        {active.map(day => (
          <div key={day} style={{ border:"1px solid #e8e8e8", borderRadius:6, overflow:"hidden" }}>
            <div style={{ background:"#111", color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", padding:"9px 14px" }}>
              {day.slice(0,3)}
            </div>
            {byDay[day].map((ev, i) => {
              const c = CAT[ev.category] || CAT.other;
              return (
                <div key={i} style={{ padding:"12px 14px", borderTop: i>0 ? "1px solid #f0f0f0" : "none", background: c.light }}>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:700, color: c.text }}>{ev.title}</div>
                  {ev.time_start && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#888", marginTop:3 }}>{fmt12(ev.time_start)}{ev.time_end ? " – "+fmt12(ev.time_end) : ""}</div>}
                  {ev.location   && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#aaa", marginTop:2 }}>{ev.location}</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Deadline Table ───────────────────────────────────────────────────────────

function DeadlineTable({ events }) {
  const dated = events.filter(e => e.date && !e.recurring).sort((a,b) => a.date > b.date ? 1 : -1);
  if (!dated.length) return null;

  return (
    <div style={{ marginBottom:56 }}>
      <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:"#111", marginBottom:24 }}>All Deadlines & Events</h3>
      <div style={{ border:"1px solid #e8e8e8", borderRadius:6, overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'DM Sans',sans-serif", fontSize:13 }}>
          <thead>
            <tr style={{ background:"#111" }}>
              {["Date","Day","Category","Event","Time","Location"].map(h => (
                <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontWeight:700, color:"#fff", fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dated.map((ev, i) => {
              const d = parseDate(ev.date);
              return (
                <tr key={ev.id} style={{ borderBottom:"1px solid #f4f4f4", background: i%2===0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding:"11px 16px", color:"#333", fontWeight:600, whiteSpace:"nowrap" }}>{ev.date}</td>
                  <td style={{ padding:"11px 16px", color:"#888", whiteSpace:"nowrap" }}>{d ? DAY_FULL[d.getDay()] : ""}</td>
                  <td style={{ padding:"11px 16px" }}><Badge cat={ev.category} /></td>
                  <td style={{ padding:"11px 16px", color:"#222", fontWeight:500 }}>{ev.title}</td>
                  <td style={{ padding:"11px 16px", color:"#666", whiteSpace:"nowrap" }}>{ev.time_start ? fmt12(ev.time_start) : "—"}</td>
                  <td style={{ padding:"11px 16px", color:"#999" }}>{ev.location || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Schedule View ────────────────────────────────────────────────────────────

function ScheduleView({ data, onBack }) {
  const [tab, setTab] = useState("monthly");

  const start = parseDate(data.semester_start) || new Date();
  const end   = parseDate(data.semester_end)   || new Date(start.getFullYear(), start.getMonth()+4, 30);

  const months = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
  }

  const tabs = [
    { id:"weekly",   label:"Weekly" },
    { id:"monthly",  label:"Monthly" },
    { id:"deadlines",label:"All Deadlines" },
  ];

  return (
    <div style={{ maxWidth:1060, margin:"0 auto", padding:"40px 24px" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:20, marginBottom:40, paddingBottom:28, borderBottom:"2px solid #111" }}>
        <div>
          <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#aaa", padding:0, marginBottom:14 }}>← Back</button>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:700, margin:0, color:"#111", lineHeight:1.2, letterSpacing:"-0.02em" }}>
            {data.course_name || "Course Schedule"}
          </h1>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"#888", marginTop:10, display:"flex", gap:20, flexWrap:"wrap" }}>
            {data.instructor       && <span>👤 {data.instructor}</span>}
            {data.semester         && <span>📅 {data.semester}</span>}
            {data.semester_start && data.semester_end && <span>🗓 {data.semester_start} – {data.semester_end}</span>}
          </div>
        </div>
        {/* Legend */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, maxWidth:300, justifyContent:"flex-end" }}>
          {Object.entries(CAT).map(([k,v]) => (
            <span key={k} style={{ background:v.bg, color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:2 }}>{v.label}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:40, borderBottom:"1px solid #e8e8e8" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:"10px 20px", background:"none", border:"none", cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight: tab===t.id ? 700 : 400,
            color: tab===t.id ? "#111" : "#aaa",
            borderBottom: tab===t.id ? "2px solid #111" : "2px solid transparent",
            marginBottom:-1, transition:"all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "weekly"    && <WeeklyBlock events={data.events} />}
      {tab === "monthly"   && months.map(({year,month}) => <MonthCal key={`${year}-${month}`} year={year} month={month} events={data.events} />)}
      {tab === "deadlines" && <DeadlineTable events={data.events} />}

    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [step, setStep] = useState("upload");
  const [data, setData] = useState(null);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #fff; -webkit-font-smoothing: antialiased; }
        button:focus { outline: none; }
        ::selection { background: #111; color: #fff; }
      `}</style>

      {/* Topbar */}
      <div style={{ position:"sticky", top:0, zIndex:100, background:"rgba(255,255,255,0.95)", backdropFilter:"blur(10px)", borderBottom:"1px solid #e8e8e8", padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:52 }}>
        <button onClick={() => setStep("upload")} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
          <span style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700, color:"#111", letterSpacing:"-0.02em" }}>
            Syllabus<span style={{ color:"#bbb", fontWeight:400 }}>Builder</span>
          </span>
        </button>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/configuration/secret";
            }}
            aria-label="secret message"
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "1px solid #d2d2d2",
              background: "#fff",
              color: "#c8c8c8",
              fontSize: 10,
              lineHeight: 1,
              padding: 0,
              cursor: "pointer",
            }}
          >
            ·
          </button>
          {step !== "upload" && (
            <button onClick={() => setStep("upload")} style={{ background:"none", border:"1px solid #e8e8e8", borderRadius:4, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#888", padding:"6px 14px" }}>
              ← New Upload
            </button>
          )}
          <button onClick={() => { setData(DEMO); setStep("schedule"); }} style={{ background:"none", border:"1px solid #e8e8e8", borderRadius:4, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#888", padding:"6px 14px" }}>
            Demo
          </button>
        </div>
      </div>

      {step === "upload"   && <UploadStep   onExtract={d => { setData(d); setStep("review"); }} />}
      {step === "review"   && <ReviewStep   data={data} onConfirm={d => { setData(d); setStep("schedule"); }} onBack={() => setStep("upload")} />}
      {step === "schedule" && <ScheduleView data={data} onBack={() => setStep("review")} />}
    </>
  );
}
