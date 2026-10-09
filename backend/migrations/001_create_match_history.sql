-- Stores the result of every resume vs. job description match
CREATE TABLE IF NOT EXISTS match_history (
  id SERIAL PRIMARY KEY,
  job_description TEXT NOT NULL,
  score INTEGER NOT NULL,
  matched_skills JSONB,
  missing_skills JSONB,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_match_history_created_at ON match_history (created_at DESC);
