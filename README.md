# Syllabus Schedule Builder

Streamlit app that:

1. Accepts a syllabus PDF upload.
2. Sends the PDF to Claude (`claude-sonnet-4-6`) for structured schedule extraction.
3. Lets the user review and edit extracted events.
4. Generates a downloadable semester schedule PDF with:
   - Weekly recurring schedule grid
   - Month-by-month calendar pages
   - Chronological table of non-recurring events

## Setup

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Add Streamlit secret in `.streamlit/secrets.toml`:

   ```toml
   ANTHROPIC_API_KEY = "your_api_key_here"
   ```

3. Run the app:

   ```bash
   streamlit run streamlit_app.py
   ```
