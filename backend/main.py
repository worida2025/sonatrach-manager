from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import PyPDF2
import pdfplumber
import io
import os
from typing import Dict, List, Optional
import json
from datetime import datetime, timedelta
import aiofiles
import shutil
from pathlib import Path
import google.generativeai as genai
import re
from dotenv import load_dotenv
import jwt
import hashlib

# Load environment variables
load_dotenv()

app = FastAPI(title="PDF Data Extraction API", version="1.0.0")

# Configure Google Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemma-3-27b-it')

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()

# User credentials (in production, use a proper database)
USERS_DB = {
    "admin": {
        "username": "admin",
        "password": hashlib.sha256("admin123".encode()).hexdigest(),
        "role": "admin"
    },
    "client": {
        "username": "client", 
        "password": hashlib.sha256("client123".encode()).hexdigest(),
        "role": "client"
    }
}

# Pydantic models for request/response
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_role: str

class UserResponse(BaseModel):
    username: str
    role: str

class SettingsRequest(BaseModel):
    ai_model_name: str

class ChatRequest(BaseModel):
    document_id: str
    message: str
    
class FieldExtractionRequest(BaseModel):
    document_id: str
    field_name: str
    
class FieldDeleteRequest(BaseModel):
    document_id: str
    field_name: str

class ChatResponse(BaseModel):
    response: str
    extracted_fields: Optional[Dict[str, str]] = None

class UpdateDocumentFieldsRequest(BaseModel):
    extracted_data: Dict[str, str]

class ChatMessage(BaseModel):
    id: str
    content: str
    sender: str
    timestamp: str
    extracted_fields: Optional[Dict[str, str]] = None

class SaveChatHistoryRequest(BaseModel):
    document_id: str
    messages: List[ChatMessage]

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Database simulation (in production, use a real database)
DOCUMENTS_DB = "documents.json"
SETTINGS_DB = "settings.json"

def load_settings():
    """Load settings from JSON file"""
    if os.path.exists(SETTINGS_DB):
        with open(SETTINGS_DB, 'r') as f:
            return json.load(f)
    return {"model_name": "gemma-3-27b-it"}

def save_settings(settings):
    """Save settings to JSON file"""
    with open(SETTINGS_DB, 'w') as f:
        json.dump(settings, f, indent=2)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(token_data: dict = Depends(verify_token)):
    username = token_data.get("sub")
    role = token_data.get("role")
    if username in USERS_DB:
        return {"username": username, "role": role}
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="User not found"
    )

def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

def load_documents():
    """Load documents from JSON file"""
    if os.path.exists(DOCUMENTS_DB):
        with open(DOCUMENTS_DB, 'r') as f:
            return json.load(f)
    return []

def save_documents(documents):
    """Save documents to JSON file"""
    with open(DOCUMENTS_DB, 'w') as f:
        json.dump(documents, f, indent=2)

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF using PyPDF2"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error extracting text with PyPDF2: {e}")
        return ""

def extract_detailed_data_from_pdf(file_content: bytes) -> Dict[str, str]:
    """Extract detailed data from PDF using pdfplumber"""
    try:
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            text = ""
            tables = []
            
            for page in pdf.pages:
                # Extract text
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                
                # Extract tables
                page_tables = page.extract_tables()
                if page_tables:
                    tables.extend(page_tables)
            
            # Analyze the content and extract meaningful data
            extracted_data = analyze_pid_content(text, tables)
            return extracted_data
            
    except Exception as e:
        print(f"Error extracting detailed data: {e}")
        return {}

def analyze_pid_content(text: str, tables: List) -> Dict[str, str]:
    """Analyze PID content and extract relevant information including GENERAL NOTES, NOTES, equipment, and service"""
    data = {}
    
    # Convert text to lowercase for easier searching
    text_lower = text.lower()
    lines = text.split('\n')
    
    # Extract two letter + four number patterns
    pattern_data = extract_two_letter_four_number_patterns(text)
    if pattern_data:
        data.update(pattern_data)
    
    # Extract enhanced notes (replaces the old simple extraction)
    notes_data = extract_enhanced_notes(text)
    if notes_data:
        data.update(notes_data)
    
    # Fallback to old method if enhanced extraction didn't find anything
    if not notes_data:
        # Extract GENERAL NOTES
        general_notes = extract_notes_section(text, "GENERAL NOTES")
        if general_notes:
            data['GENERAL NOTES'] = general_notes
        
        # Extract NOTES
        notes = extract_notes_section(text, "NOTES")
        if notes:
            data['NOTES'] = notes
    
    # Extract Equipment information
    equipment_info = extract_equipment_info(text)
    if equipment_info:
        data.update(equipment_info)
    
    # Extract Service information
    service_info = extract_service_info(text)
    if service_info:
        data.update(service_info)
    
    # Look for title/drawing number
    for line in lines[:10]:  # Check first 10 lines for title
        if any(keyword in line.lower() for keyword in ['drawing', 'title', 'diagram', 'process']):
            if len(line.strip()) > 5:
                data['Document Title'] = line.strip()
                break
    
    # Look for revision information
    for line in lines:
        if 'rev' in line.lower() or 'revision' in line.lower():
            # Extract revision info
            words = line.split()
            for i, word in enumerate(words):
                if 'rev' in word.lower() and i + 1 < len(words):
                    data['Revision'] = words[i + 1]
                    break
            break
    
    # Look for date information
    import re
    date_pattern = r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b'
    dates = re.findall(date_pattern, text)
    if dates:
        data['Document Date'] = dates[0]
    
    # Look for equipment tags (typically alphanumeric patterns)
    equipment_pattern = r'\b[A-Z]{1,3}[-]?\d{3,5}[A-Z]?\b'
    equipment_tags = re.findall(equipment_pattern, text)
    if equipment_tags:
        data['Equipment Count'] = str(len(set(equipment_tags)))
        data['Sample Equipment Tags'] = ', '.join(list(set(equipment_tags))[:5])
    
    # Look for pressure ratings
    pressure_pattern = r'\b\d+\.?\d*\s*(psi|bar|kpa|mpa)\b'
    pressures = re.findall(pressure_pattern, text_lower)
    if pressures:
        data['Pressure Ratings Found'] = ', '.join(pressures[:3])
    
    # Look for temperature ratings
    temp_pattern = r'\b\d+\.?\d*\s*°?[cf]\b|\b\d+\.?\d*\s*deg\s*[cf]\b'
    temperatures = re.findall(temp_pattern, text_lower)
    if temperatures:
        data['Temperature Ratings Found'] = ', '.join(temperatures[:3])
    
    # Analyze tables if present
    if tables:
        data['Tables Found'] = str(len(tables))
        # Extract information from first table
        if tables[0] and len(tables[0]) > 0:
            headers = tables[0][0] if tables[0][0] else []
            data['Table Headers'] = ', '.join([str(h) for h in headers if h])
    
    # Add some default information
    data['Document Type'] = 'Process & Instrumentation Diagram'
    data['Status'] = 'Uploaded'
    data['Processing Date'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    return data

def extract_notes_section(text: str, section_name: str) -> str:
    """Extract notes sections like GENERAL NOTES or NOTES"""
    lines = text.split('\n')
    notes_content = []
    capturing = False
    
    for line in lines:
        line_upper = line.upper().strip()
        
        # Start capturing when we find the section
        if section_name.upper() in line_upper and not capturing:
            capturing = True
            # Include the current line if it has content after the section name
            if len(line.strip()) > len(section_name):
                notes_content.append(line.strip())
            continue
        
        # Stop capturing if we hit another section header
        if capturing and (line_upper.startswith('NOTES:') or 
                         line_upper.startswith('GENERAL NOTES:') or
                         line_upper.startswith('SPECIFICATIONS:') or
                         line_upper.startswith('EQUIPMENT:') or
                         line_upper.startswith('SERVICE:') or
                         (len(line_upper) > 0 and line_upper.isupper() and ':' in line_upper)):
            if section_name.upper() not in line_upper:
                break
        
        # Capture content lines
        if capturing and line.strip():
            notes_content.append(line.strip())
    
    return '\n'.join(notes_content) if notes_content else ""

def extract_two_letter_four_number_patterns(text: str) -> Dict[str, str]:
    """Extract all patterns containing two letters followed by 4 numbers"""
    pattern_data = {}
    
    # Pattern: two letters followed by 4 numbers (case insensitive)
    # Examples: AB1234, XY5678, etc.
    pattern = r'\b[A-Za-z]{2}\d{4}\b'
    matches = re.findall(pattern, text)
    
    if matches:
        # Remove duplicates and sort
        unique_matches = sorted(list(set(matches)))
        pattern_data['Two Letter Four Number Patterns'] = ', '.join(unique_matches)
        pattern_data['Pattern Count'] = str(len(unique_matches))
        
        # Categorize patterns if they follow common engineering conventions
        categorized = {}
        for match in unique_matches:
            prefix = match[:2].upper()
            number = match[2:]
            
            # Common engineering prefixes
            if prefix in ['PV', 'CV', 'FV', 'LV', 'TV']:  # Valves
                if 'Valves' not in categorized:
                    categorized['Valves'] = []
                categorized['Valves'].append(match)
            elif prefix in ['PI', 'FI', 'TI', 'LI', 'AI']:  # Instruments
                if 'Instruments' not in categorized:
                    categorized['Instruments'] = []
                categorized['Instruments'].append(match)
            elif prefix in ['PT', 'FT', 'TT', 'LT', 'AT']:  # Transmitters
                if 'Transmitters' not in categorized:
                    categorized['Transmitters'] = []
                categorized['Transmitters'].append(match)
            elif prefix in ['PC', 'FC', 'TC', 'LC', 'AC']:  # Controllers
                if 'Controllers' not in categorized:
                    categorized['Controllers'] = []
                categorized['Controllers'].append(match)
            else:
                if 'Other Equipment' not in categorized:
                    categorized['Other Equipment'] = []
                categorized['Other Equipment'].append(match)
        
        # Add categorized data
        for category, items in categorized.items():
            pattern_data[f'{category} ({len(items)})'] = ', '.join(items)
    
    return pattern_data

def extract_enhanced_notes(text: str) -> Dict[str, str]:
    """Enhanced extraction of notes and general notes with better parsing"""
    notes_data = {}
    
    # Split text into lines for better processing
    lines = text.split('\n')
    
    # Enhanced patterns for finding notes sections
    note_patterns = [
        r'GENERAL\s+NOTES?:?',
        r'NOTES?:?',
        r'DESIGN\s+NOTES?:?',
        r'PROCESS\s+NOTES?:?',
        r'OPERATING\s+NOTES?:?',
        r'SAFETY\s+NOTES?:?',
        r'MAINTENANCE\s+NOTES?:?'
    ]
    
    for pattern in note_patterns:
        notes_content = extract_notes_by_pattern(text, pattern)
        if notes_content:
            # Determine the section name
            section_name = re.search(pattern, text, re.IGNORECASE)
            if section_name:
                clean_name = section_name.group().replace(':', '').strip().title()
                notes_data[clean_name] = notes_content
    
    # Also look for numbered notes (1., 2., 3., etc.)
    numbered_notes = extract_numbered_notes(text)
    if numbered_notes:
        notes_data['Numbered Notes'] = numbered_notes
    
    # Look for bullet point notes
    bullet_notes = extract_bullet_notes(text)
    if bullet_notes:
        notes_data['Bullet Point Notes'] = bullet_notes
    
    return notes_data

def extract_notes_by_pattern(text: str, pattern: str) -> str:
    """Extract notes using a specific regex pattern"""
    lines = text.split('\n')
    notes_content = []
    capturing = False
    
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        
        # Check if this line matches our pattern
        if re.search(pattern, line, re.IGNORECASE):
            capturing = True
            # Include any content after the pattern on the same line
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                after_pattern = line[match.end():].strip()
                if after_pattern:
                    notes_content.append(after_pattern)
            continue
        
        if capturing:
            # Stop if we hit another major section
            if (line_stripped and 
                (re.match(r'^[A-Z\s]+:$', line_stripped) or  # All caps section headers
                 re.match(r'^\d+\.\s*[A-Z]', line_stripped) or  # Numbered sections
                 'SPECIFICATIONS' in line_stripped.upper() or
                 'EQUIPMENT LIST' in line_stripped.upper() or
                 'LEGEND' in line_stripped.upper() or
                 'SYMBOLS' in line_stripped.upper())):
                break
            
            # Capture non-empty lines
            if line_stripped:
                notes_content.append(line_stripped)
            elif notes_content:  # Preserve empty lines within notes but not at the beginning
                notes_content.append('')
    
    # Clean up the content
    while notes_content and not notes_content[-1]:  # Remove trailing empty lines
        notes_content.pop()
    
    return '\n'.join(notes_content)

def extract_numbered_notes(text: str) -> str:
    """Extract numbered notes (1., 2., 3., etc.)"""
    lines = text.split('\n')
    numbered_notes = []
    
    for line in lines:
        line_stripped = line.strip()
        # Look for lines starting with numbers followed by a period
        if re.match(r'^\d+\.\s+.+', line_stripped):
            numbered_notes.append(line_stripped)
    
    return '\n'.join(numbered_notes) if numbered_notes else ""

def extract_bullet_notes(text: str) -> str:
    """Extract bullet point notes (•, -, *, etc.)"""
    lines = text.split('\n')
    bullet_notes = []
    
    for line in lines:
        line_stripped = line.strip()
        # Look for lines starting with bullet characters
        if re.match(r'^[•\-\*]\s+.+', line_stripped):
            bullet_notes.append(line_stripped)
    
    return '\n'.join(bullet_notes) if bullet_notes else ""

def extract_equipment_info(text: str) -> Dict[str, str]:
    """Extract equipment information from the document"""
    equipment_data = {}
    
    # Look for equipment tags
    equipment_pattern = r'\b[A-Z]{1,3}[-]?\d{3,5}[A-Z]?\b'
    equipment_tags = re.findall(equipment_pattern, text)
    
    # Look for common equipment types
    equipment_types = []
    common_equipment = ['pump', 'tank', 'valve', 'heat exchanger', 'reactor', 'compressor', 'separator', 'filter']
    
    for equipment in common_equipment:
        if equipment.lower() in text.lower():
            equipment_types.append(equipment.title())
    
    if equipment_tags:
        equipment_data['Equipment Tags'] = ', '.join(list(set(equipment_tags)))
        equipment_data['Equipment Count'] = str(len(set(equipment_tags)))
    
    if equipment_types:
        equipment_data['Equipment Types'] = ', '.join(list(set(equipment_types)))
    
    return equipment_data

def extract_service_info(text: str) -> Dict[str, str]:
    """Extract service information from the document"""
    service_data = {}
    
    # Look for service-related keywords
    service_keywords = ['cooling water', 'steam', 'nitrogen', 'compressed air', 'instrument air', 
                       'natural gas', 'fuel gas', 'electrical', 'hydraulic', 'pneumatic']
    
    found_services = []
    for service in service_keywords:
        if service.lower() in text.lower():
            found_services.append(service.title())
    
    if found_services:
        service_data['Services'] = ', '.join(list(set(found_services)))    
    # Look for utility connections
    utility_pattern = r'\b(CW|SW|IA|NA|NG|FG|STM)\b'
    utilities = re.findall(utility_pattern, text)
    if utilities:
        service_data['Utility Codes'] = ', '.join(list(set(utilities)))
    
    return service_data

def extract_single_field_with_ai(document_text: str, query: str) -> Dict[str, str]:
    """Use Gemini AI to extract a single specific field and return it as a dictionary"""
    prompt = f"""
    You are an expert at extracting specific information from engineering documents.
    
    Document content:
    {document_text}
    
    Task: {query}
    
    Extract ONLY ONE field based on the user's request. Determine an appropriate field name and extract its value.
    
    Respond in the following JSON format:
    {{"field_name": "value"}}
    
    For example:
    - If asked for "operating temperature", respond: {{"Operating Temperature": "150°C"}}
    - If asked for "pressure rating", respond: {{"Pressure Rating": "300 PSI"}}
    - If asked for "equipment ID", respond: {{"Equipment ID": "P-101"}}
    
    If the information is not found, respond: {{"Error": "Information not found in document"}}
    
    Return only the JSON object, no other text.
    """
    
    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Try to parse as JSON
        import json
        try:
            # Remove any markdown formatting
            if response_text.startswith('```json'):
                response_text = response_text.replace('```json', '').replace('```', '').strip()
            elif response_text.startswith('```'):
                response_text = response_text.replace('```', '').strip()
            
            parsed_response = json.loads(response_text)
            
            # If it's a valid dictionary with one key-value pair, return it
            if isinstance(parsed_response, dict) and len(parsed_response) == 1:
                return parsed_response
            elif isinstance(parsed_response, dict) and len(parsed_response) > 1:
                # Take only the first field
                first_key = list(parsed_response.keys())[0]
                return {first_key: parsed_response[first_key]}
            else:
                # Fallback if parsing fails
                return {"Extracted Field": response_text}
                
        except json.JSONDecodeError:
            # If JSON parsing fails, try to extract field name and value manually
            lines = response_text.split('\n')
            for line in lines:
                if ':' in line:
                    parts = line.split(':', 1)
                    if len(parts) == 2:
                        field_name = parts[0].strip().strip('"')
                        field_value = parts[1].strip().strip('"')
                        return {field_name: field_value}
            
            # Final fallback
            return {"Extracted Information": response_text}
            
    except Exception as e:
        return {"Error": f"Error extracting field: {str(e)}"}

def load_chat_history():
    """Load chat history from JSON file"""
    chat_history_file = "chat_history.json"
    if os.path.exists(chat_history_file):
        with open(chat_history_file, 'r') as f:
            return json.load(f)
    return {}

def save_chat_history(chat_history):
    """Save chat history to JSON file"""
    chat_history_file = "chat_history.json"
    with open(chat_history_file, 'w') as f:
        json.dump(chat_history, f, indent=2)

# Authentication routes
@app.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    username = request.username
    password = hashlib.sha256(request.password.encode()).hexdigest()
    
    if username in USERS_DB and USERS_DB[username]["password"] == password:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": username, "role": USERS_DB[username]["role"]},
            expires_delta=access_token_expires
        )
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user_role=USERS_DB[username]["role"]
        )
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password"
    )

@app.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return UserResponse(username=current_user["username"], role=current_user["role"])

# Admin-only routes
@app.get("/admin/settings")
async def get_settings(admin_user: dict = Depends(require_admin)):
    return load_settings()

@app.post("/admin/settings")
async def update_settings(settings: SettingsRequest, admin_user: dict = Depends(require_admin)):
    current_settings = load_settings()
    current_settings["model_name"] = settings.ai_model_name
    save_settings(current_settings)
    
    # Update the global model
    global model
    model = genai.GenerativeModel(settings.ai_model_name)
    
    return {"status": "success", "message": "Settings updated successfully"}

@app.get("/")
async def root():
    return {"message": "PDF Data Extraction API is running"}

@app.post("/upload/")
async def upload_pdf(file: UploadFile = File(...), admin_user: dict = Depends(require_admin)):
    """Upload and process a PDF file (Admin only)"""
    
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Read file content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
      # Save file to uploads directory with unique name
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    file_extension = Path(file.filename).suffix
    unique_filename = f"{timestamp}_{file.filename}"
    file_path = UPLOAD_DIR / unique_filename
    
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")
    
    # Extract data from PDF
    try:
        extracted_data = extract_detailed_data_from_pdf(content)
        
        # Add file information
        extracted_data.update({
            'File Name': file.filename,
            'File Size': f"{len(content) / 1024 / 1024:.2f} MB",
            'Upload Date': datetime.now().strftime('%Y-%m-%d'),
            'File Path': str(file_path)
        })
        
        # Save to database
        documents = load_documents()
        document_entry = {
            'id': timestamp,
            'filename': file.filename,
            'original_filename': file.filename,
            'stored_filename': unique_filename,
            'upload_date': datetime.now().isoformat(),
            'file_size': len(content),
            'extracted_data': extracted_data,
            'status': 'processed'
        }
        documents.append(document_entry)
        save_documents(documents)
        
        return JSONResponse(content={
            "status": "success",
            "message": "PDF processed successfully",
            "extracted_data": extracted_data,
            "document_id": document_entry['id']
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@app.get("/documents/")
async def get_documents(current_user: dict = Depends(get_current_user)):
    """Get list of all uploaded documents"""
    documents = load_documents()
    return JSONResponse(content={
        "status": "success",
        "documents": documents
    })

@app.get("/documents/{document_id}")
async def get_document(document_id: str, current_user: dict = Depends(get_current_user)):
    """Get specific document by ID"""
    documents = load_documents()
    document = next((doc for doc in documents if doc['id'] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return JSONResponse(content={
        "status": "success",
        "document": document
    })

@app.get("/documents/{document_id}/download")
async def download_document(document_id: str):
    """Download a document file"""
    documents = load_documents()
    document = next((doc for doc in documents if doc['id'] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get file path from stored filename or original filename
    stored_filename = document.get('stored_filename', document['filename'])
    file_path = UPLOAD_DIR / stored_filename
    
    # If stored filename doesn't exist, try original filename
    if not file_path.exists():
        file_path = UPLOAD_DIR / document['filename']
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found on server")
    
    return FileResponse(
        path=str(file_path),
        filename=document.get('original_filename', document['filename']),
        media_type='application/pdf'
    )

@app.delete("/documents/{document_id}")
async def delete_document(document_id: str, admin_user: dict = Depends(require_admin)):
    """Delete a document (Admin only)"""
    documents = load_documents()
    document = next((doc for doc in documents if doc['id'] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Remove from list
    documents = [doc for doc in documents if doc['id'] != document_id]
    save_documents(documents)
    
    # Delete file if exists
    try:
        file_path = Path(document.get('extracted_data', {}).get('File Path', ''))
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        print(f"Error deleting file: {e}")
    
    return JSONResponse(content={
        "status": "success",
        "message": "Document deleted successfully"
    })

@app.post("/documents/{document_id}/chat")
async def chat_with_document(document_id: str, request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Chat with a document using Gemini AI to extract information"""
    documents = load_documents()
    document = next((doc for doc in documents if doc['id'] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get the document's text content
    file_path = UPLOAD_DIR / document.get('stored_filename', document['filename'])
    if not file_path.exists():
        file_path = UPLOAD_DIR / document['filename']
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found")
    
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
        document_text = extract_text_from_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading document: {str(e)}")
      # Create prompt for Gemini
    prompt = f"""
    You are an expert at analyzing engineering documents, particularly P&ID (Process and Instrumentation Diagrams) and technical datasheets.
    
    Document content:
    {document_text}
    
    User question: {request.message}
    
    Important: If the user is asking to extract a field, extract ONLY ONE field. Provide a helpful response and if extracting a field, 
    provide the extracted information in a clear format.
    
    If you extract a field, the response should clearly identify the field name and its value.
    """
    
    try:
        response = model.generate_content(prompt)
        ai_response = response.text
          # Check if user is asking to extract a specific field
        extracted_fields = None
        if any(keyword in request.message.lower() for keyword in ['extract', 'find', 'get', 'show me']):
            extracted_fields = extract_single_field_with_ai(document_text, request.message)
        
        return JSONResponse(content={
            "status": "success",
            "response": ai_response,
            "extracted_fields": extracted_fields
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

@app.post("/documents/{document_id}/extract-field")
async def extract_field(document_id: str, request: FieldExtractionRequest, admin_user: dict = Depends(require_admin)):
    """Extract a specific field from a document and add it to the extracted data (Admin only)"""
    documents = load_documents()
    document = next((doc for doc in documents if doc['id'] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get the document's text content
    file_path = UPLOAD_DIR / document.get('stored_filename', document['filename'])
    if not file_path.exists():
        file_path = UPLOAD_DIR / document['filename']
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found")
    
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
        document_text = extract_text_from_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading document: {str(e)}")
    
    # Use AI to extract the specific field
    try:
        field_value = extract_field_with_ai(document_text, f"Extract the field '{request.field_name}' from this document")
        
        # Update the document's extracted data
        if 'extracted_data' not in document:
            document['extracted_data'] = {}
        
        document['extracted_data'][request.field_name] = field_value
        
        # Save the updated document
        for i, doc in enumerate(documents):
            if doc['id'] == document_id:
                documents[i] = document
                break
        
        save_documents(documents)
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Field '{request.field_name}' extracted successfully",
            "field_name": request.field_name,
            "field_value": field_value
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting field: {str(e)}")

@app.delete("/documents/{document_id}/fields/{field_name}")
async def delete_field(document_id: str, field_name: str):
    """Delete a specific field from a document's extracted data"""
    documents = load_documents()
    document = next((doc for doc in documents if doc['id'] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if 'extracted_data' not in document or field_name not in document['extracted_data']:
        raise HTTPException(status_code=404, detail="Field not found")
    
    # Remove the field
    del document['extracted_data'][field_name]
    
    # Save the updated document
    for i, doc in enumerate(documents):
        if doc['id'] == document_id:
            documents[i] = document
            break
    
    save_documents(documents)
    
    return JSONResponse(content={
        "status": "success",
        "message": f"Field '{field_name}' deleted successfully"
    })

@app.put("/documents/{document_id}/fields")
async def update_document_fields(document_id: str, request: UpdateDocumentFieldsRequest, admin_user: dict = Depends(require_admin)):
    """Update the extracted data fields for a document (Admin only)"""
    documents = load_documents()
    document = next((doc for doc in documents if doc['id'] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update the document's extracted data
    if 'extracted_data' not in document:
        document['extracted_data'] = {}
    
    document['extracted_data'].update(request.extracted_data)
    
    # Save the updated document
    for i, doc in enumerate(documents):
        if doc['id'] == document_id:
            documents[i] = document
            break
    
    save_documents(documents)
    
    return JSONResponse(content={
        "status": "success",
        "message": "Document fields updated successfully"
    })

def extract_field_with_ai(document_text: str, query: str) -> str:
    """Use Gemini AI to extract specific field information"""
    prompt = f"""
    You are an expert at extracting specific information from engineering documents.
    
    Document content:
    {document_text}
    
    Task: {query}
    
    Please extract the requested information from the document. If the information is not available, 
    clearly state that it was not found. Provide only the extracted value without additional explanation.
    """
    
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"Error extracting field: {str(e)}"

@app.post("/chat")
async def chat_with_all_documents(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Chat with all documents using their extracted data"""
    documents = load_documents()
    
    if not documents:
        return JSONResponse(content={
            "status": "success",
            "response": "No documents have been uploaded yet. Please upload some documents first to start chatting.",
            "extracted_fields": None
        })
    
    # Collect all extracted data from all documents
    all_extracted_data = {}
    document_summaries = []
    
    for doc in documents:
        extracted_data = doc.get('extracted_data', {})
        if extracted_data:
            all_extracted_data[doc['filename']] = extracted_data
            
        # Create a summary for each document
        summary = {
            'filename': doc['filename'],
            'upload_date': doc.get('upload_date', ''),
            'extracted_fields_count': len(extracted_data),
            'key_fields': list(extracted_data.keys())[:5] if extracted_data else []
        }
        document_summaries.append(summary)
    
    # Create prompt for Gemini with all available data
    extracted_data_text = ""
    for filename, data in all_extracted_data.items():
        extracted_data_text += f"\n\nDocument: {filename}\n"
        for key, value in data.items():
            extracted_data_text += f"- {key}: {value}\n"
    
    prompt = f"""
    You are an expert assistant for analyzing engineering documents and extracted data. You have access to data extracted from multiple uploaded documents.
    
    Available documents and their extracted data:
    {extracted_data_text}
    
    Document summaries:
    {json.dumps(document_summaries, indent=2)}
    
    User question: {request.message}
    
    Please provide a helpful response based on the available extracted data from all documents. You can:
    1. Answer questions about specific fields or values
    2. Compare data across different documents
    3. Provide summaries or insights
    4. Help find specific information
    5. Explain technical details found in the documents
    
    If the user asks about something not available in the extracted data, let them know what information IS available.
    """
    
    try:
        response = model.generate_content(prompt)
        ai_response = response.text
        
        # Check if user is asking to extract or find specific information
        extracted_fields = None
        if any(keyword in request.message.lower() for keyword in ['extract', 'find', 'get', 'show me', 'list', 'what are']):
            # Find relevant data based on the question
            extracted_fields = find_relevant_data(all_extracted_data, request.message)
        
        return JSONResponse(content={
            "status": "success",
            "response": ai_response,
            "extracted_fields": extracted_fields
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

def find_relevant_data(all_extracted_data: dict, question: str) -> dict:
    """Find data relevant to the user's question from all documents"""
    relevant_data = {}
    question_lower = question.lower()
    
    # Keywords to search for in the question
    keywords = question_lower.split()
    
    for document, data in all_extracted_data.items():
        for field, value in data.items():
            # Check if any keyword matches the field name or value
            if any(keyword in field.lower() or keyword in str(value).lower() for keyword in keywords):
                if document not in relevant_data:
                    relevant_data[document] = {}
                relevant_data[document][field] = value
    
    return relevant_data if relevant_data else None

@app.get("/documents/{document_id}/chat-history")
async def get_chat_history(document_id: str, current_user: dict = Depends(get_current_user)):
    """Get chat history for a specific document"""
    chat_history = load_chat_history()
    document_chat = chat_history.get(document_id, [])
    
    return JSONResponse(content={
        "status": "success",
        "messages": document_chat
    })

@app.post("/documents/{document_id}/save-chat")
async def save_document_chat_history(document_id: str, request: SaveChatHistoryRequest, current_user: dict = Depends(get_current_user)):
    """Save chat history for a specific document"""
    chat_history = load_chat_history()
    
    # Convert Pydantic models to dict
    messages_dict = [msg.dict() for msg in request.messages]
    chat_history[document_id] = messages_dict
    
    save_chat_history(chat_history)
    
    return JSONResponse(content={
        "status": "success",
        "message": "Chat history saved successfully"
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
