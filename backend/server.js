const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import Database Pool
const pool = require('./db');
const runMigrations = require('./migrate');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
  }
})
const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      const err = new Error('Only PDF and DOCX files are supported.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const aiEngineDir = path.resolve(__dirname, '../ai-engine');
const pythonExecutable = process.env.PYTHON_PATH || (process.platform === 'win32'
  ? path.join(aiEngineDir, 'venv/Scripts/python.exe')
  : path.join(aiEngineDir, 'venv/bin/python'));

// Run a Python script without a shell (no command injection, no command-line length limit).
// Optional `input` is written to the script's stdin.
const runPython = (scriptName, args, input) => new Promise((resolve) => {
  const child = execFile(
    pythonExecutable,
    [path.join(aiEngineDir, scriptName), ...args],
    { maxBuffer: 10 * 1024 * 1024, timeout: 120000 },
    (error, stdout, stderr) => {
      let result = null;
      try {
        result = JSON.parse(stdout);
      } catch {
        // leave result as null
      }
      if (error && !result) {
        console.error(`Error executing ${scriptName}: ${error.message}\n${stderr}`);
      }
      resolve({ error, result });
    }
  );
  child.stdin.end(input ?? '', 'utf8');
});

const removeUpload = (file) => {
  if (file) fs.promises.unlink(file.path).catch(() => {});
};

app.post('/api/match', upload.single('resume'), async (req, res) => {
    const jobDescription = req.body.jobDescription;

    try {
        if (!req.file || !jobDescription) {
            return res.status(400).json({ error: 'Please provide both a resume (PDF or DOCX) and a job description.' });
        }

        // Job description is sent via stdin to avoid command-line length limits
        const { result } = await runPython('matcher.py', [req.file.path], jobDescription);

        if (!result) {
            return res.status(500).json({ error: 'Invalid response from AI engine' });
        }
        if (result.error) {
            return res.status(422).json({ error: result.error });
        }

        // Save to Database
        try {
            await pool.query(
                'INSERT INTO match_history (job_description, score, matched_skills, missing_skills, feedback) VALUES ($1, $2, $3, $4, $5)',
                [
                    jobDescription,
                    result.score,
                    JSON.stringify(result.matched_skills),
                    JSON.stringify(result.missing_skills),
                    result.feedback
                ]
            );
        } catch (dbErr) {
            console.error("Failed to save to database (Ensure your .env credentials are correct):", dbErr.message);
            // We still want to return the result to the user even if DB save fails
        }

        res.json(result);
    } finally {
        removeUpload(req.file);
    }
});

app.post('/api/recommend', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Please provide a resume (PDF or DOCX).' });
        }

        const country = req.body.country || '';
        const city = req.body.city || '';

        const { result } = await runPython('recommender.py', [req.file.path, country, city]);

        if (!result) {
            return res.status(500).json({ error: 'Invalid response from AI engine' });
        }
        if (result.error) {
            return res.status(422).json({ error: result.error });
        }

        res.json(result);
    } finally {
        removeUpload(req.file);
    }
});

// Handle upload errors (bad file type, file too large) and anything else unexpected
app.use((err, req, res, next) => {
    removeUpload(req.file);
    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5 MB).' : err.message;
        return res.status(400).json({ error: message });
    }
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
});

// Apply any pending database migrations on startup
runMigrations()
    .then(() => console.log("Database migrations are up to date."))
    .catch((err) => console.error("Error running database migrations (Check your credentials!):", err.message));
