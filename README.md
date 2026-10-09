# AI Resume Matcher

Upload a resume (PDF or DOCX) to:
- **Match** it against a job description (text or URL) and get a score, matched/missing skills and feedback.
- **Find jobs** — get recommended remote job postings based on the resume's top skills.
- **Check ATS compatibility** — font, alignment and format checks with a score and tips for each.
- **Download an optimized resume** — for DOCX uploads, the same file with the missing skills added in its own formatting.

## How it works

```
Browser (React)  →  Backend API (Express)  →  AI engine (Python)
                          ↓
                    PostgreSQL (saves match history)
```

1. You upload a resume and a job description in the browser.
2. The backend receives the file and runs the Python AI engine.
3. The AI engine reads the resume, compares it with the job, checks ATS rules and returns the results.
4. The backend saves the result in the database and sends it back to the browser.

## Tools used

### Frontend (`frontend/`) — what the user sees

| Tool | Purpose |
| --- | --- |
| **React** | Builds the user interface: Dashboard, Job Postings, ATS check cards, light/dark theme. |
| **Vite** | Runs the app during development (`npm run dev`) and builds it for production. |
| **oxlint** | Checks the JavaScript code for mistakes. |
| **CSS (`index.css`)** | Styling, colours and the light/dark theme variables. |

### Backend (`backend/`) — the server in the middle

| Tool | Purpose |
| --- | --- |
| **Node.js** | Runs the server-side JavaScript. |
| **Express** | Creates the API endpoints: `/api/match` (resume vs. job) and `/api/recommend` (job suggestions). |
| **Multer** | Receives the uploaded resume file (PDF/DOCX) from the browser. |
| **CORS** | Allows the frontend (port 5173) to talk to the backend (port 5000). |
| **pg** | Connects to the PostgreSQL database. |
| **dotenv** | Loads settings such as database password and port from the `.env` file. |
| **child_process** | Runs the Python AI engine scripts and reads their results. |

### AI engine (`ai-engine/`) — the "brain"

| Tool | Purpose |
| --- | --- |
| **Python** | Language used for all text analysis. |
| **spaCy** (`en_core_web_sm`) | Natural language processing: finds keywords/skills in the resume and job description. |
| **scikit-learn** | TF-IDF + cosine similarity to calculate the match score (%). |
| **PyPDF2** | Extracts text from PDF resumes and counts pages. |
| **pdfminer.six** | Reads exact fonts, sizes and text positions in PDFs for the ATS font/alignment checks. |
| **python-docx** | Reads DOCX resumes (fonts, alignment, margins) and creates the optimized DOCX with added skills. |
| **Requests** | Downloads a job description from a URL and fetches live job postings. |
| **BeautifulSoup** | Pulls clean text out of a job posting web page. |
| **Remotive API** | Free public source of the remote job postings shown on the Job Postings page. |

| File | Purpose |
| --- | --- |
| `matcher.py` | Match score, matched/missing skills, feedback, optimized resume. |
| `ats_checker.py` | Font, alignment and format checks (Arial/Calibri, 11 pt body, 0.5–1" margins, etc.). |
| `recommender.py` | Finds job postings that fit the resume's top skills. |

### Database

| Tool | Purpose |
| --- | --- |
| **PostgreSQL** | Stores each analysis (job description, score, skills, feedback) in the `match_history` table. |
| **Migrations** (`backend/migrations/`) | SQL files that create/update the database tables automatically. |

### Other

| Tool | Purpose |
| --- | --- |
| **Git / GitHub** | Version control and code hosting. |

## Project structure

| Folder | What it is |
| --- | --- |
| `frontend/` | React + Vite UI |
| `backend/` | Node.js / Express API, PostgreSQL |
| `ai-engine/` | Python scripts (spaCy, scikit-learn) called by the backend |

## Setup

### Prerequisites
Node.js 20+, Python 3.10+, PostgreSQL.

### 1. AI engine
```bash
cd ai-engine
python -m venv venv
# Windows: venv\Scripts\activate    macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env      # then fill in your database credentials
npm run migrate           # creates the database tables
npm start                 # http://localhost:5000
```
Migrations in `backend/migrations/` also run automatically when the server starts.
To change the schema, add a new numbered file, e.g. `002_add_column.sql`.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
