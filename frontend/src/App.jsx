import { useState, useRef } from 'react';
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

function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  
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
        <div className="user-profile">
          <div className="avatar"></div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Profile Status</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}><span className="status-dot"></span> Online</div>
          </div>
        </div>
        <ul className="nav-links">
          <li className={`nav-item ${activeTab === 'Dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('Dashboard')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Dashboard
          </li>
          <li className="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            Analysis
          </li>
          <li className="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            My Resumes
          </li>
          <li className={`nav-item ${activeTab === 'Job Postings' ? 'active' : ''}`} onClick={() => setActiveTab('Job Postings')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            Job Postings
          </li>
          <li className="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            Reports
          </li>
          <li className="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Settings
          </li>
        </ul>
        
        <div style={{ marginTop: 'auto', padding: '1.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
           <button style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '20px', padding: '0.5rem 1.5rem', color: 'var(--text-main)', display: 'flex', gap: '1rem', cursor: 'pointer' }}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
           </button>
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
                  if (result && result.optimized_resume_html) {
                    const element = document.createElement("a");
                    const file = new Blob([result.optimized_resume_html], {type: 'text/html'});
                    element.href = URL.createObjectURL(file);
                    element.download = "Optimized_Resume.html";
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
            <button className="btn-outline">Share Report</button>
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
                <div className="ats-check-item">
                  <div className="ats-check-header">
                    <div className="check-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <div className="check-title">Font Check</div>
                    <div className="check-badge">Pass</div>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{width: '100%'}}></div></div>
                </div>
                <div className="ats-check-item">
                  <div className="ats-check-header">
                    <div className="check-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <div className="check-title">Alignment Check</div>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{width: '95%'}}></div></div>
                </div>
                <div className="ats-check-item">
                  <div className="ats-check-header">
                    <div className="check-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <div className="check-title">Format Check</div>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{width: '98%'}}></div></div>
                </div>
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
                  style={{ width: '100%', padding: '0.75rem', marginBottom: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }}
                  onChange={(e) => setRecCountry(e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="City (e.g. New York, Hyderabad)" 
                  style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }}
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
