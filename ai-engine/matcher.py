import sys
import json
import html
import spacy
import requests
from bs4 import BeautifulSoup
from PyPDF2 import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Load spaCy English model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print(json.dumps({"error": "spaCy model en_core_web_sm not found."}))
    sys.exit(1)

def get_text_from_url(url):
    """Fetch content from a job portal URL and extract plain text."""
    try:
        # User agent is often required to bypass basic bot blockers on job boards
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "header", "footer", "nav"]):
            script.extract()
            
        # Get text and clean it up
        text = soup.get_text(separator=' ')
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text
    except Exception:
        # Signal failure so the caller can report it instead of scoring an error message
        return None

def parse_resume(file_path):
    text = ""
    try:
        if file_path.lower().endswith('.docx'):
            import docx
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

def extract_keywords(text):
    """
    Extract nouns and proper nouns as potential skills using spaCy.
    """
    doc = nlp(text.lower())
    # Extract entities and key nouns
    keywords = set()
    for token in doc:
        if token.pos_ in ["NOUN", "PROPN"] and not token.is_stop and len(token.text) > 1:
            keywords.add(token.text)
    return list(keywords)

def compute_similarity(text1, text2):
    """
    Compute Cosine Similarity between two text documents using TF-IDF.
    """
    vectorizer = TfidfVectorizer(stop_words='english')
    try:
        tfidf_matrix = vectorizer.fit_transform([text1, text2])
        sim_score = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return round(sim_score * 100)
    except ValueError:
        return 0

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing resume path"}))
        sys.exit(1)

    resume_path = sys.argv[1]
    # Job description is passed via stdin (avoids command-line length limits)
    job_description_input = sys.stdin.buffer.read().decode('utf-8', errors='replace').strip()
    if not job_description_input:
        print(json.dumps({"error": "Missing job description"}))
        sys.exit(1)

    # 0. Check if job description is a URL
    if job_description_input.startswith('http://') or job_description_input.startswith('https://'):
        job_description = get_text_from_url(job_description_input)
        if not job_description:
            print(json.dumps({"error": "Could not fetch the job description from that URL. Please paste the job description text instead."}))
            sys.exit(1)
    else:
        job_description = job_description_input

    # 1. Parse Resume
    resume_text = parse_resume(resume_path)
    if not resume_text:
        print(json.dumps({"error": "Could not extract text from the resume. Please upload a text-based PDF or DOCX file."}))
        sys.exit(1)
    
    # 2. Extract Keywords (Simulated Skills)
    resume_keywords = extract_keywords(resume_text)
    job_keywords = extract_keywords(job_description)
    
    # 3. Match Skills (Exact Keyword Matching)
    matched_skills = list(set(resume_keywords) & set(job_keywords))
    missing_skills = list(set(job_keywords) - set(resume_keywords))
    
    # 4. Compute Semantic Similarity Score (TF-IDF Cosine Similarity)
    # Use this as the main score instead of just keyword counting
    similarity_score = compute_similarity(resume_text, job_description)
    
    # 5. Generate Feedback & Optimized Resume
    # Dynamic Explanation of Match
    if len(matched_skills) > 0 and len(missing_skills) == 0:
        feedback = f"Excellent match! You possess all the key skills we identified in the job description, particularly {', '.join(matched_skills[:3])}."
    elif similarity_score > 60:
        feedback = f"Strong match. Your background in {', '.join(matched_skills[:3])} aligns well with the role. However, you lack experience in {', '.join(missing_skills[:2])} which are required."
    elif similarity_score > 30:
        feedback = f"Moderate match. You have some foundational skills like {matched_skills[0] if matched_skills else 'general experience'}, but you are missing several core requirements such as {', '.join(missing_skills[:3])}. We recommend focusing on acquiring these missing skills."
    else:
        feedback = f"Low match score. Your resume is missing the majority of the required skills, specifically {', '.join(missing_skills[:3])}. Consider tailoring your resume more closely to the job description if you have these skills."

    lines = resume_text.split('\n')
    formatted_body = ""
    skills_injected = False

    for line in lines:
        original_line = line
        line = line.strip()
        if not line:
            continue
        safe_line = html.escape(line)
            
        # Guess headers by length and capitalization
        is_header = (len(line) < 40 and (line.isupper() or line.istitle()))
        
        if is_header:
            formatted_body += f"<h2 style='color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px; margin-top: 20px;'>{safe_line}</h2>"

            # If this is the skills section, inject the missing skills right after it!
            if not skills_injected and "skill" in line.lower():
                formatted_body += f"<p style='margin-bottom: 5px; line-height: 1.6; color: #27ae60; font-weight: bold;'>[AI Added] {html.escape(', '.join(missing_skills))}</p>"
                skills_injected = True
        else:
            formatted_body += f"<p style='margin-bottom: 5px; line-height: 1.6;'>{safe_line}</p>"

    # If we didn't find a skills section, append one at the end
    if not skills_injected and len(missing_skills) > 0:
        formatted_body += f"<h2 style='color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px; margin-top: 20px;'>Key Skills (AI Added)</h2>"
        formatted_body += f"<p style='margin-bottom: 5px; line-height: 1.6; color: #27ae60; font-weight: bold;'>{html.escape(', '.join(missing_skills))}</p>"

    # Create the HTML structure
    optimized_html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Optimized Resume</title>
        <style>
            body {{ font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }}
        </style>
    </head>
    <body>
        <div style="background-color: #eafaf1; border-left: 5px solid #2ecc71; padding: 15px; margin-bottom: 20px;">
            <strong>Success!</strong> The missing skills required for this job description have been automatically injected into your resume below in green.
        </div>
        <div class="original-content">
            {formatted_body}
        </div>
    </body>
    </html>
    """

    result = {
        "score": similarity_score,
        "matched_skills": matched_skills[:15],
        "missing_skills": missing_skills[:15],
        "feedback": feedback,
        "optimized_resume_html": optimized_html
    }
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()



