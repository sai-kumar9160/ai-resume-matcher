import { useState, useRef, useEffect } from 'react';
import './App.css';

const ACCEPTED_FILE_TYPES = '.pdf,.docx';

// Returns the file if it is a PDF or DOCX, otherwise alerts and returns null
const validateResumeFile = (file) => {
  if (!file) return null;
  if (!/\.(pdf|docx)$/i.test(file.name)) {
    alert('Only PDF and DOCX files are supported.');
    return null;
  }
  return file;
};

const ATS_CHECKS = [
  { key: 'font', title: 'Font Check' },
  { key: 'alignment', title: 'Alignment Check' },
  { key: 'format', title: 'Format Check' },
];
const STATUS_LABELS = { pass: 'Pass', warn: 'Needs work', fail: 'Fail' };

// One row of the ATS panel; `check` is {score, status, issues, passes} from the AI engine
const AtsCheckItem = ({ title, check }) => {
  const status = check?.status || 'pending';
  const tip = check && (check.issues.length ? check.issues : check.passes.slice(0, 1));
  return (
    <div className={`ats-check-item ats-${status}`}>
      <div className="ats-check-header">
        <div className="check-icon">
          {status === 'pass' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
          {status === 'warn' && <span>!</span>}
          {status === 'fail' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>}
        </div>
        <div className="check-title">{title}</div>
        {check && <div className="check-badge">{STATUS_LABELS[status]} · {check.score}%</div>}
      </div>
      <div className="progress-track"><div className="progress-fill" style={{width: `${check?.score ?? 0}%`}}></div></div>
      {check
        ? <ul className="check-details">{tip.slice(0, 2).map((t, i) => <li key={i}>{t}</li>)}</ul>
        : <p className="check-note">Run an analysis to check your resume.</p>}
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'dark'; } catch { return 'dark'; }
  });

  // Apply the theme to <html> so the CSS variables switch, and remember the choice
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);
  
  // Dashboard State
  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Job Postings State
  const [recResumeFile, setRecResumeFile] = useState(null);
  const [recCountry, setRecCountry] = useState('');
  const [recCity, setRecCity] = useState('');
  const [isRecDragging, setIsRecDragging] = useState(false);
  const [isRecLoading, setIsRecLoading] = useState(false);
  const [recResult, setRecResult] = useState(null);
  
  const fileInputRef = useRef(null);
  const recFileInputRef = useRef(null);

  // --- Handlers for Dashboard (1-to-1 Match) ---
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const file = validateResumeFile(e.dataTransfer.files?.[0]);
    if (file) setResumeFile(file);
  };
  const handleFileChange = (e) => {
    const file = validateResumeFile(e.target.files?.[0]);
    if (file) setResumeFile(file);
  };
  const handleSubmit = async () => {
    if (!resumeFile || !jobDescription) return alert('Provide both resume and JD.');
    setIsLoading(true); setResult(null);

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('jobDescription', jobDescription);

    try {
      const response = await fetch('http://localhost:5000/api/match', { method: 'POST', body: formData });
      const data = await response.json();
      if (response.ok) setResult(data);
      else alert(data.error || 'Something went wrong.');
    } catch {
      alert('Failed to connect to the backend server.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers for Job Postings (1-to-Many Match) ---
  const handleRecDrop = (e) => {
    e.preventDefault(); setIsRecDragging(false);
    const file = validateResumeFile(e.dataTransfer.files?.[0]);
    if (file) setRecResumeFile(file);
  };
  const handleRecFileChange = (e) => {
    const file = validateResumeFile(e.target.files?.[0]);
    if (file) setRecResumeFile(file);
  };
  const handleRecommend = async () => {
    if (!recResumeFile) return alert('Please upload a resume first.');
    setIsRecLoading(true); setRecResult(null);

    const formData = new FormData();
    formData.append('resume', recResumeFile);
    formData.append('country', recCountry);
    formData.append('city', recCity);

    try {
      const response = await fetch('http://localhost:5000/api/recommend', { method: 'POST', body: formData });
      const data = await response.json();
      if (response.ok) setRecResult(data);
      else alert(data.error || 'Something went wrong.');
    } catch {
      alert('Failed to connect to the backend server.');
    } finally {
      setIsRecLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <ul className="nav-links">
          <li className={`nav-item ${activeTab === 'Dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('Dashboard')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Dashboard
          </li>
          <li className={`nav-item ${activeTab === 'Job Postings' ? 'active' : ''}`} onClick={() => setActiveTab('Job Postings')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            Job Postings
          </li>
        </ul>
        
        <div style={{ marginTop: 'auto', padding: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <div className="theme-toggle" role="group" aria-label="Color theme">
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')} aria-pressed={theme === 'light'} title="Light mode">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            </button>
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'} title="Dark mode">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="top-header">
          <h1>{activeTab === 'Dashboard' ? 'At-a-Glance' : 'Live Job Postings'}</h1>
          <div className="header-actions">
            {activeTab === 'Dashboard' && (
                <button 
                className="btn-outline" 
                onClick={() => {
                  if (result && (result.optimized_resume_docx || result.optimized_resume_html)) {
                    const element = document.createElement("a");
                    let file;
                    if (result.optimized_resume_docx) {
                      // Same DOCX as uploaded, with the missing skills added in its own formatting
                      const bytes = Uint8Array.from(atob(result.optimized_resume_docx), c => c.charCodeAt(0));
                      file = new Blob([bytes], {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
                      element.download = (resumeFile?.name || 'Resume.docx').replace(/\.docx$/i, '') + '_Optimized.docx';
                    } else {
                      file = new Blob([result.optimized_resume_html], {type: 'text/html'});
                      element.download = "Optimized_Resume.html";
                    }
                    element.href = URL.createObjectURL(file);
                    document.body.appendChild(element);
                    element.click();
                    document.body.removeChild(element);
                  } else {
                    alert("Please run an analysis first to download your optimized resume.");
                  }
                }}
              >
                Download Optimized Resume
              </button>
            )}
          </div>
        </div>

        {activeTab === 'Dashboard' && (
            <div className="dashboard-grid">
              {/* Top Score Panel */}
              <div className="panel score-panel">
                <div>
                  <div className="score-gauge"></div>
                  <div style={{ textAlign: 'center', marginTop: '-35px' }} className="score-text">{result ? result.score : 0}%</div>
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Match Score</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Compared to JD</p>
                </div>
                <div className="info-tags" style={{ marginLeft: 'auto' }}>
                  <span className="info-tag">Experience: {result ? "Matches JD" : "N/A"}</span>
                  <span className="info-tag">Top Skills: {result?.matched_skills?.slice(0, 3).join(', ') || 'N/A'}</span>
                </div>
              </div>

              {/* Analysis Form & Results */}
              <div className="panel col-span-1">
                <div className="panel-title">New Analysis</div>
                <textarea 
                  rows="4" 
                  placeholder="Paste Job Description URL (http...) or raw text here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
                <div 
                  className="upload-area"
                  style={{ borderColor: isDragging ? 'var(--primary)' : 'var(--border)' }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {resumeFile ? <strong style={{color: 'var(--primary)'}}>{resumeFile.name}</strong> : "Drag & Drop PDF or DOCX"}
                  <input type="file" accept={ACCEPTED_FILE_TYPES} ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                </div>
                <button className="btn-primary" onClick={handleSubmit} disabled={isLoading}>
                  {isLoading ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>

              {/* ATS Compatibility Check */}
              <div className="panel col-span-1">
                <div className="panel-title">ATS Compatibility Check</div>
                {result?.ats_checks?.error && (
                  <p className="check-note">{result.ats_checks.error}</p>
                )}
                {ATS_CHECKS.map(({ key, title }) => (
                  <AtsCheckItem key={key} title={title} check={result?.ats_checks?.[key]} />
                ))}
              </div>

              {/* AI Feedback Table */}
              <div className="panel col-span-1">
                <div className="panel-title">AI Feedback Loop</div>
                <table className="feedback-table">
                  <thead>
                    <tr>
                      <th>Skill Gap / Suggestion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result ? (
                      <>
                        <tr>
                          <td>{result.feedback}</td>
                        </tr>
                        {result.missing_skills?.slice(0,2).map((skill, i) => (
                          <tr key={i}>
                            <td>Consider adding <strong style={{color:'var(--warning)'}}>{skill}</strong> to your experience.</td>
                          </tr>
                        ))}
                      </>
                    ) : (
                      <tr>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          Run an analysis to see AI feedback.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
        )}

        {activeTab === 'Job Postings' && (
            <div className="dashboard-grid">
               <div className="panel col-span-1">
                <div className="panel-title">Find Matching Jobs</div>
                <p style={{color: 'var(--text-muted)', marginBottom: '1rem'}}>Upload your resume and enter your location to find matching jobs.</p>
                
                <input 
                  type="text" 
                  placeholder="Country (e.g. US, India)" 
                  style={{ width: '100%', padding: '0.75rem', marginBottom: '0.5rem', background: 'var(--overlay)', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '4px' }}
                  onChange={(e) => setRecCountry(e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="City (e.g. New York, Hyderabad)" 
                  style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'var(--overlay)', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '4px' }}
                  onChange={(e) => setRecCity(e.target.value)}
                />

                <div 
                  className="upload-area"
                  style={{ borderColor: isRecDragging ? 'var(--primary)' : 'var(--border)' }}
                  onDragOver={(e) => { e.preventDefault(); setIsRecDragging(true); }}
                  onDragLeave={() => setIsRecDragging(false)}
                  onDrop={handleRecDrop}
                  onClick={() => recFileInputRef.current?.click()}
                >
                  {recResumeFile ? <strong style={{color: 'var(--primary)'}}>{recResumeFile.name}</strong> : "Drag & Drop Resume PDF or DOCX"}
                  <input type="file" accept={ACCEPTED_FILE_TYPES} ref={recFileInputRef} onChange={handleRecFileChange} style={{ display: 'none' }} />
                </div>
                <button className="btn-primary" onClick={handleRecommend} disabled={isRecLoading}>
                  {isRecLoading ? 'Searching Job Portals...' : 'Find Jobs'}
                </button>
              </div>

              <div className="panel col-span-2">
                <div className="panel-title">Recommended Postings</div>
                {recResult ? (
                    <div>
                        <div style={{marginBottom: '1rem', color: 'var(--text-muted)'}}>
                            Found {recResult.recommended_jobs.length} remote jobs for your top skill: <strong style={{color: 'var(--primary)'}}>{recResult.search_query}</strong>
                        </div>
                        {recResult.recommended_jobs.map((job, idx) => (
                            <div className="job-card" key={idx}>
                                <div className="job-info">
                                    <h3>{job.title}</h3>
                                    <p>{job.company} &bull; <span style={{color: 'var(--primary)'}}>{job.location}</span></p>
                                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="job-link">View Application &rarr;</a>
                                </div>
                                <div className="job-score">
                                    <span>{job.score}%</span>
                                    <small>Match</small>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 0' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{marginBottom: '1rem', opacity: 0.5}}>
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <p>Upload your resume to discover matching jobs.</p>
                    </div>
                )}
              </div>
            </div>
        )}

      </main>
    </div>
  );
}

export default App;
