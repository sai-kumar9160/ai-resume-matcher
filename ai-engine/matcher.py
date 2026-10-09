import sys
import json
import html
import re
import spacy
import requests
from bs4 import BeautifulSoup
from PyPDF2 import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from ats_checker import analyze_ats

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

def build_optimized_docx(file_path, skills):
    """
    Add the missing skills to the original DOCX, keeping its formatting.
    The new line is a copy of the last line in the skills section (same font, size,
    bullets, bold label), so it looks like it was always part of the resume.
    Returns the file as base64, or None if it can't be built.
    """
    import base64
    import io
    from copy import deepcopy
    import docx
    from docx.text.paragraph import Paragraph

    if not skills:
        return None
    doc = docx.Document(file_path)
    paras = [p for p in doc.paragraphs if p.text.strip()]

    def is_heading(p):
        t = p.text.strip()
        return len(t) < 40 and (t.isupper() or t.istitle()) and ':' not in t

    skills_text = ', '.join(skills)
    start = next((i for i, p in enumerate(paras) if is_heading(p) and 'skill' in p.text.lower()), None)
    if start is not None:
        end = next((i for i in range(start + 1, len(paras)) if is_heading(paras[i])), len(paras))
        template, label = paras[end - 1] if end - 1 > start else paras[start], "Additional Skills"
    else:
        # No skills section: add one at the end, copying the last heading and body line
        heading = next((p for p in reversed(paras) if is_heading(p)), None)
        if heading is None:
            return None
        new_heading = deepcopy(heading._p)
        paras[-1]._p.addnext(new_heading)
        heading_para = Paragraph(new_heading, paras[-1]._parent)
        for r in heading_para.runs[1:]:
            r._r.getparent().remove(r._r)
        heading_para.runs[0].text = "KEY SKILLS" if heading.text.isupper() else "Key Skills"
        template, label = paras[-1], None
        paras[-1] = heading_para

    new_p = deepcopy(template._p)
    (paras[end - 1] if start is not None else paras[-1])._p.addnext(new_p)
    para = Paragraph(new_p, template._parent)
    runs = para.runs
    # "Label: values" lines keep a bold label run and a plain value run
    label_run = runs[0] if label and runs and runs[0].bold and ':' in template.text else None
    value_run = next((r for r in runs if not r.bold and r.text.strip()), None) if label_run else None
    keep = [r for r in (label_run, value_run) if r is not None] or runs[:1]
    for r in runs:
        if r not in keep:
            r._r.getparent().remove(r._r)
    if label_run is not None and value_run is not None:
        label_run.text = f"{label}: "
        value_run.text = skills_text
    elif keep:
        keep[0].text = f"{label}: {skills_text}" if label else skills_text
        keep[0].bold = None if label else keep[0].bold

    out = io.BytesIO()
    doc.save(out)
    return base64.b64encode(out.getvalue()).decode('ascii')

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
    section_words = ("summary", "objective", "profile", "skill", "experience", "education",
                     "project", "certification", "achievement", "internship", "language",
                     "interest", "hobbies", "declaration", "training", "award", "strength")
    name_done = False
    in_header_block = True  # lines between the name and the first section heading

    for line in lines:
        line = line.strip()
        if not line:
            continue
        safe_line = html.escape(line)
        lower = line.lower()

        # Guess headers by length and capitalization
        is_header = (len(line) < 40 and (line.isupper() or line.istitle()))
        is_section = is_header and any(w in lower for w in section_words)
        is_contact = len(line) < 150 and ('@' in line or 'linkedin' in lower or re.search(r'\+?\d[\d\s-]{8,}', line))

        # First line of the resume is the candidate's name
        if not name_done:
            formatted_body += f"<h1 class='name'>{safe_line}</h1>"
            name_done = True
            continue

        if is_section:
            in_header_block = False

        if in_header_block and is_contact:
            formatted_body += f"<p class='contact'>{safe_line}</p>"
        elif in_header_block and (is_header or '|' in line):
            formatted_body += f"<p class='job-title'>{safe_line}</p>"
        elif is_header:
            formatted_body += f"<h2>{safe_line}</h2>"

            # If this is the skills section, inject the missing skills right after it!
            if not skills_injected and "skill" in lower:
                formatted_body += f"<p class='ai-added'>[AI Added] {html.escape(', '.join(missing_skills))}</p>"
                skills_injected = True
        else:
            formatted_body += f"<p>{safe_line}</p>"

    # If we didn't find a skills section, append one at the end
    if not skills_injected and len(missing_skills) > 0:
        formatted_body += "<h2>Key Skills (AI Added)</h2>"
        formatted_body += f"<p class='ai-added'>{html.escape(', '.join(missing_skills))}</p>"

    # Create the HTML structure
    optimized_html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Optimized Resume</title>
        <style>
            @page {{ size: A4; margin: 0.75in; }}
            body {{ font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.15; max-width: 8.27in; margin: 0 auto; padding: 0.75in; box-sizing: border-box; color: #333; }}
            .name {{ font-size: 22pt; font-weight: bold; color: #2c3e50; margin: 0 0 4pt 0; padding-bottom: 4pt; border-bottom: 2px solid #3498db; }}
            .job-title {{ font-size: 12pt; font-weight: bold; color: #2c3e50; margin: 2pt 0; }}
            .contact {{ font-size: 10pt; margin: 2pt 0; }}
            h2 {{ font-size: 13pt; font-weight: bold; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 3pt; margin: 12pt 0 6pt 0; }}
            p {{ font-size: 11pt; margin: 0 0 4pt 0; text-align: justify; }}
            .ai-added {{ color: #27ae60; font-weight: bold; text-align: left; }}
            .notice {{ font-size: 10pt; background-color: #eafaf1; border-left: 5px solid #2ecc71; padding: 10px; margin-bottom: 14pt; }}
            @media print {{ body {{ padding: 0; max-width: none; }} .notice {{ display: none; }} }}
        </style>
    </head>
    <body>
        <div class="notice">
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
        "optimized_resume_html": optimized_html,
        "ats_checks": analyze_ats(resume_path, resume_text)
    }
    # DOCX uploads also get an edited copy of the original file with the skills added
    if resume_path.lower().endswith('.docx'):
        try:
            # Keywords are lowercased; use the spelling from the job description (AWS, PostgreSQL)
            cased = []
            for skill in missing_skills:
                m = re.search(r'\b' + re.escape(skill) + r'\b', job_description, re.IGNORECASE)
                cased.append(m.group(0) if m else skill)
            result["optimized_resume_docx"] = build_optimized_docx(resume_path, cased)
        except Exception:
            result["optimized_resume_docx"] = None
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()



