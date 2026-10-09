# AI Resume Matcher

Upload a resume (PDF or DOCX) to:
- **Match** it against a job description (text or URL) and get a score, matched/missing skills and feedback.
- **Find jobs** — get recommended remote job postings based on the resume's top skills.

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
