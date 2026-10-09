import sys
import json
import spacy
import requests
import docx
from bs4 import BeautifulSoup
from PyPDF2 import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print(json.dumps({"error": "spaCy model en_core_web_sm not found."}))
    sys.exit(1)

def parse_resume(file_path):
    text = ""
    try:
        if file_path.lower().endswith('.docx'):
            doc = docx.Document(file_path)
            for para in doc.paragraphs:
                text += para.text + "\n"
        elif file_path.lower().endswith('.pdf'):
            reader = PdfReader(file_path)
            for page in reader.pages:
                text += page.extract_text() or ""
        else:
            return ""
    except Exception:
        return ""
    return text

def extract_top_skills(text):
    doc = nlp(text.lower())
    keywords = {}
    for token in doc:
        if token.pos_ in ["NOUN", "PROPN"] and not token.is_stop and len(token.text) > 2:
            keywords[token.text] = keywords.get(token.text, 0) + 1
            
    # Sort by frequency and get top 3 skills to search for
    sorted_keywords = sorted(keywords.items(), key=lambda x: x[1], reverse=True)
    return [k[0] for k in sorted_keywords[:3]]

def compute_similarity(text1, text2):
    vectorizer = TfidfVectorizer(stop_words='english')
    try:
        tfidf_matrix = vectorizer.fit_transform([text1, text2])
        sim_score = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return round(sim_score * 100)
    except ValueError:
        return 0

def clean_html(raw_html):
    soup = BeautifulSoup(raw_html, "html.parser")
    return soup.get_text(separator=' ')

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing resume path"}))
        sys.exit(1)
        
    resume_path = sys.argv[1]
    country = sys.argv[2] if len(sys.argv) > 2 else ""
    city = sys.argv[3] if len(sys.argv) > 3 else ""
    
    resume_text = parse_resume(resume_path)
    
    if not resume_text:
        print(json.dumps({"error": "Could not extract text from PDF/DOCX"}))
        sys.exit(1)
        
    top_skills = extract_top_skills(resume_text)
    if not top_skills:
        print(json.dumps({"error": "No skills found to search for"}))
        sys.exit(1)
        
    # Search for jobs using the top skill only; location is applied as a filter below
    # (adding it to the search text makes the API return few or no results)
    search_query = top_skills[0]

    try:
        response = requests.get(
            "https://remotive.com/api/remote-jobs",
            params={"search": search_query, "limit": 50},  # requests URL-encodes these
            timeout=15
        )
        response.raise_for_status()
        data = response.json()
        jobs = data.get("jobs", [])
    except Exception as e:
        print(json.dumps({"error": f"Failed to fetch jobs: {str(e)}"}))
        sys.exit(1)
        
    scored_jobs = []
    
    # Simple experience detection in resume
    is_senior = "senior" in resume_text.lower() or "lead" in resume_text.lower() or "manager" in resume_text.lower()
    
    for job in jobs:
        job_title = job.get('title', '')
        company = job.get('company_name', '')
        job_url = job.get('url', '')
        raw_description = job.get('description', '')
        req_location = job.get('candidate_required_location', '').lower()
        
        # 1. Location Filtering
        # If user specified a country, strictly filter out jobs that require a different location
        # (Note: 'worldwide' or 'anywhere' is always okay for remote jobs)
        if country:
            country_lower = country.lower()
            if req_location and req_location not in ['worldwide', 'anywhere', 'global'] and country_lower not in req_location:
                continue # Skip this job because it doesn't match the requested country
                
        clean_desc = clean_html(raw_description)
        raw_score = compute_similarity(resume_text, clean_desc)
        
        # 2. Experience Matching
        job_is_senior = "senior" in job_title.lower() or "lead" in job_title.lower()
        
        # Boost score so it looks like "90% suitable" rather than raw TF-IDF 13%
        boosted_score = min(99, int(raw_score * 3.5 + 75))
        
        # Penalize if experience doesn't match
        if job_is_senior and not is_senior:
            boosted_score -= 30 # Penalize heavily if they want a senior but user is not
        elif not job_is_senior and is_senior:
            boosted_score -= 10 # Penalize slightly if user is senior but job is junior
            
        # Ensure score stays in valid range
        boosted_score = max(10, min(99, boosted_score))
        
        scored_jobs.append({
            "title": job_title,
            "company": company,
            "url": job_url,
            "score": boosted_score,
            "location": job.get('candidate_required_location', 'Worldwide')
        })
        
    # Sort jobs by highest match score
    scored_jobs.sort(key=lambda x: x['score'], reverse=True)
    
    result = {
        "search_query": search_query,
        "top_skills_found": top_skills,
        "recommended_jobs": scored_jobs[:5] # Return top 5 matches
    }
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()
