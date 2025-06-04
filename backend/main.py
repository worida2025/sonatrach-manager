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
from tag_extraction import process_pdf_for_tags, get_tag_extraction_stats, get_extracted_tags_for_file
from datasheet_splitter import datasheet_splitter

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

class DatasheetChatRequest(BaseModel):
    datasheet_id: str
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

class DatasheetChatResponse(BaseModel):
    response: str
    datasheet_id: str
    equipment_name: str

class UpdateDocumentFieldsRequest(BaseModel):
    extracted_data: Dict[str, str]

class ChatMessage(BaseModel):
    id: str
    content: str
    sender: str
    timestamp: str
    extracted_fields: Optional[Dict[str, str]] = None

class DatasheetInfo(BaseModel):
    id: str
    equipment_name: str
    pages: str
    created_at: str
    fields_count: int

class DatasheetProcessResponse(BaseModel):
    status: str
    message: str
    document_id: Optional[str] = None
    datasheets: List[Dict] = []

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
    
    # Check if this is an instrumentation datasheet
    is_instrumentation_datasheet = any(keyword in text_lower for keyword in [
        'instrumentation data sheet', 'control valves', 'valve data sheet', 
        'instrument data', 'datasheet'
    ])
    
    if is_instrumentation_datasheet:
        data['Document Type'] = 'Instrumentation Data Sheet'
        
        # Extract specific instrumentation data
        instrumentation_data = extract_instrumentation_data(text, tables)
        if instrumentation_data:
            data.update(instrumentation_data)
    else:
        data['Document Type'] = 'Process & Instrumentation Diagram'
    
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
    
    # Extract project information
    project_info = extract_project_info(text)
    if project_info:
        data.update(project_info)
    
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
    data['Status'] = 'Uploaded'
    data['Processing Date'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    return data

def extract_instrumentation_data(text: str, tables: List) -> Dict[str, str]:
    """Extract specific data from instrumentation datasheets"""
    data = {}
    lines = text.split('\n')
    
    # Look for project information
    project_patterns = {
        'Project Number': r'Project\s+N[°o]?\s*[-:]?\s*([A-Z0-9-]+)',
        'Unit': r'Unit\s+[-:]?\s*([A-Z0-9-]+)',
        'Document Class': r'Document\s+Class\s*[:.]?\s*([A-Z0-9\s]+)',
        'Serial Number': r'Serial\s+Number\s*[:.]?\s*([A-Z0-9-]+)',
        'Material Code': r'Material\s+Code\s*[:.]?\s*([A-Z0-9-]+)',
    }
    
    for key, pattern in project_patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            data[key] = match.group(1).strip()
    
    # Extract revision history
    revision_data = extract_revision_history(text)
    if revision_data:
        data.update(revision_data)
    
    # Extract valve specifications if this is a control valve datasheet
    if 'control valve' in text.lower():
        valve_data = extract_valve_specifications(text, tables)
        if valve_data:
            data.update(valve_data)
    
    # Count total pages
    page_pattern = r'(\d+)/(\d+)'
    page_matches = re.findall(page_pattern, text)
    if page_matches:
        # Get the highest page number
        total_pages = max([int(match[1]) for match in page_matches])
        data['Total Pages'] = str(total_pages)
    
    return data

def extract_project_info(text: str) -> Dict[str, str]:
    """Extract project information from any document"""
    data = {}
    
    # Look for refinery/plant information
    if 'algiers refinery' in text.lower():
        data['Facility'] = 'Algiers Refinery'
    if 'rehabilitation and adaptation project' in text.lower():
        data['Project Type'] = 'Rehabilitation and Adaptation Project'
    
    # Look for company information
    if 'sonatrach' in text.lower():
        data['Owner'] = 'Sonatrach'
    
    return data

def extract_revision_history(text: str) -> Dict[str, str]:
    """Extract revision history from document"""
    data = {}
    
    # Look for revision table pattern
    revision_pattern = r'(\d+)\s+(\d{2}/[A-Z]{3}/\d{2,4})\s+([\w\s]+)\s+([A-Z\.]+)\s+([A-Z\.]+)\s+([A-Z\.]+)'
    revisions = re.findall(revision_pattern, text)
    
    if revisions:
        latest_revision = revisions[0]  # First match is usually the latest
        data['Latest Revision'] = latest_revision[0]
        data['Revision Date'] = latest_revision[1]
        data['Revision Description'] = latest_revision[2].strip()
        data['Drawn By'] = latest_revision[3]
        data['Checked By'] = latest_revision[4]
        data['Approved By'] = latest_revision[5]
        data['Total Revisions'] = str(len(revisions))
    
    return data

def extract_valve_specifications(text: str, tables: List) -> Dict[str, str]:
    """Extract valve specifications from control valve datasheets"""
    data = {}
    
    # Count valve entries in tables
    valve_count = 0
    valve_tags = set()
    
    for table in tables:
        for row in table:
            if row:
                for cell in row:
                    if cell and isinstance(cell, str):
                        # Look for valve tags (pattern like FV-1234, PV-5678, etc.)
                        valve_pattern = r'\b[A-Z]{1,3}V[-]?\d{3,5}[A-Z]?\b'
                        found_valves = re.findall(valve_pattern, cell)
                        valve_tags.update(found_valves)
    
    if valve_tags:
        data['Total Valves'] = str(len(valve_tags))
        data['Sample Valve Tags'] = ', '.join(list(valve_tags)[:10])
    
    # Look for common valve specifications
    spec_patterns = {
        'Valve Body Material': r'Body\s+Material[:\s]+([A-Za-z0-9\s]+)',
        'Valve Size': r'Size[:\s]+(\d+["\s]*\w*)',
        'Valve Class': r'Class[:\s]+(\d+)',
        'End Connection': r'End\s+Connection[:\s]+([A-Za-z0-9\s]+)',
    }
    
    for key, pattern in spec_patterns.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            # Take the most common match
            data[key] = matches[0].strip()
    
    return data

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
    """Extract and categorize different types of notes from the document"""
    notes_data = {}
    
    # Look for different types of notes
    note_patterns = [
        r'GENERAL NOTES(.*?)(?=\n[A-Z][A-Z]|\n\s*\n|$)',
        r'NOTES(.*?)(?=\n[A-Z][A-Z]|\n\s*\n|$)',
        r'NOTE:?(.*?)(?=\n[A-Z][A-Z]|\n\s*\n|$)',
    ]
    
    for i, pattern in enumerate(note_patterns):
        matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)
        if matches:
            notes_data[f'Notes Section {i+1}'] = matches[0].strip()
    
    # Extract numbered notes
    numbered_notes = re.findall(r'(\d+\.\s+[^0-9]+?)(?=\d+\.|$)', text, re.DOTALL)
    if numbered_notes:
        for i, note in enumerate(numbered_notes[:10]):  # Limit to first 10 notes
            notes_data[f'Note {i+1}'] = note.strip()
    
    return notes_data

def extract_equipment_info(text: str) -> Dict[str, str]:
    """Extract equipment information from the document"""
    equipment_data = {}
    
    # Extract equipment tags using various patterns
    equipment_patterns = [
        r'([A-Z]{1,3}-?\d{3}-?[A-Z]?-?\d{3,4}[A-Z]?(?:/[AB])?)',  # Equipment tags
        r'EQUIPMENT\s+(\d{3}-[A-Z]-\d{3})',  # Equipment format
        r'TAG\s*NO\.?\s*([A-Z]{2,3}-?\d{3,4})',  # Tag numbers
    ]
    
    all_equipment = set()
    for pattern in equipment_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        all_equipment.update(matches)
    
    if all_equipment:
        # Sort and limit equipment tags
        sorted_equipment = sorted(list(all_equipment))
        equipment_data['Equipment Tags'] = ', '.join(sorted_equipment[:20])  # Limit to 20
        equipment_data['Equipment Count'] = str(len(all_equipment))
        
        # Sample first 5 for quick reference
        equipment_data['Sample Equipment Tags'] = ', '.join(sorted_equipment[:5])
    
    # Extract equipment types
    equipment_types = set()
    type_patterns = [
        r'(PUMP)', r'(VALVE)', r'(HEAT EXCHANGER)', r'(VESSEL)', r'(DRUM)',
        r'(COMPRESSOR)', r'(TURBINE)', r'(SEPARATOR)', r'(REACTOR)', r'(COLUMN)'
    ]
    
    for pattern in type_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            equipment_types.add(pattern.strip('()').title())
    
    if equipment_types:
        equipment_data['Equipment Types'] = ', '.join(sorted(equipment_types))
    
    return equipment_data

def extract_service_info(text: str) -> Dict[str, str]:
    """Extract service information from the document"""
    service_data = {}
    
    # Common services in process documents
    services = [
        'Steam', 'Cooling Water', 'Process Water', 'Instrument Air',
        'Nitrogen', 'Natural Gas', 'Fuel Gas', 'Compressed Air',
        'Hydraulic', 'Thermal Oil', 'Hot Oil', 'Condensate'
    ]
    
    found_services = []
    for service in services:
        if re.search(rf'\b{service}\b', text, re.IGNORECASE):
            found_services.append(service)
    
    if found_services:
        service_data['Services'] = ', '.join(found_services)
    
    return service_data

def extract_notes_section(text: str, section_name: str) -> str:
    """Extract a specific notes section from the document"""
    pattern = rf'{section_name}(.*?)(?=\n[A-Z][A-Z]|\n\s*\n|$)'
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    
    if match:
        return match.group(1).strip()
    
    return ""

# API Endpoints

@app.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Authenticate user and return JWT token"""
    username = request.username
    password = hashlib.sha256(request.password.encode()).hexdigest()
    
    if username in USERS_DB and USERS_DB[username]["password"] == password:
        user_data = {"sub": username, "role": USERS_DB[username]["role"]}
        token = create_access_token(user_data)
        
        return LoginResponse(
            access_token=token,
            token_type="bearer",
            user_role=USERS_DB[username]["role"]
        )
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

@app.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(username=current_user["username"], role=current_user["role"])

@app.post("/upload/")
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload and process a PDF file"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    stored_filename = f"{timestamp}_{file.filename}"
    file_path = UPLOAD_DIR / stored_filename
    
    # Save uploaded file
    try:
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Extract data from PDF
    try:
        extracted_data = extract_detailed_data_from_pdf(content)
        
        # Process for tag extraction
        tag_result = None
        try:
            tag_result = process_pdf_for_tags(str(file_path))
        except Exception as e:
            print(f"Tag extraction failed: {e}")
        
        # Create document record
        document = {
            "id": timestamp,
            "filename": file.filename,
            "original_filename": file.filename,
            "stored_filename": stored_filename,
            "upload_date": datetime.now().isoformat(),
            "file_size": len(content),
            "extracted_data": extracted_data,
            "status": "processed"
        }
        
        if tag_result:
            document["tag_extraction_result"] = tag_result
        
        # Save to documents database
        documents = load_documents()
        documents.append(document)
        save_documents(documents)
        
        # Process for datasheet splitting if it's an instrumentation datasheet
        try:
            text = extract_text_from_pdf(content)
            if "instrumentation data sheet" in text.lower() or "data sheet" in text.lower():
                datasheet_splitter(str(file_path))
        except Exception as e:
            print(f"Datasheet splitting failed: {e}")
        
        return {
            "status": "success",
            "message": "File uploaded and processed successfully",
            "document_id": timestamp,
            "extracted_data": extracted_data,
            "tag_extraction_result": tag_result
        }
        
    except Exception as e:
        # Clean up file if processing failed
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")

@app.get("/documents/")
async def get_documents(current_user: dict = Depends(get_current_user)):
    """Get all uploaded documents"""
    documents = load_documents()
    return {"status": "success", "documents": documents}

@app.get("/documents/{document_id}")
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific document by ID"""
    documents = load_documents()
    document = next((doc for doc in documents if doc["id"] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return document

@app.put("/documents/{document_id}")
async def update_document(
    document_id: str,
    request: UpdateDocumentFieldsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update document extracted data"""
    documents = load_documents()
    document = next((doc for doc in documents if doc["id"] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update extracted data
    document["extracted_data"].update(request.fields)
    save_documents(documents)
    
    return {"status": "success", "message": "Document updated successfully"}

@app.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(require_admin)
):
    """Delete a document (admin only)"""
    documents = load_documents()
    document_index = next((i for i, doc in enumerate(documents) if doc["id"] == document_id), None)
    
    if document_index is None:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document = documents[document_index]
    
    # Delete file
    file_path = UPLOAD_DIR / document["stored_filename"]
    if file_path.exists():
        file_path.unlink()
    
    # Remove from database
    documents.pop(document_index)
    save_documents(documents)
    
    return {"status": "success", "message": "Document deleted successfully"}

@app.get("/documents/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download original PDF file"""
    documents = load_documents()
    document = next((doc for doc in documents if doc["id"] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = UPLOAD_DIR / document["stored_filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=document["original_filename"],
        media_type="application/pdf"
    )

@app.post("/documents/{document_id}/extract")
async def extract_field(
    document_id: str,
    request: FieldExtractionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Extract specific field from document using AI"""
    documents = load_documents()
    document = next((doc for doc in documents if doc["id"] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Load PDF content
    file_path = UPLOAD_DIR / document["stored_filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
        
        text = extract_text_from_pdf(content)
        
        # Use AI to extract specific field
        prompt = f"""
        Extract the "{request.field_name}" from the following PDF text.
        Provide only the extracted value, no explanation.
        
        Text:
        {text[:5000]}  # Limit text to avoid token limits
        """
        
        response = model.generate_content(prompt)
        extracted_value = response.text.strip()
        
        # Update document
        document["extracted_data"][request.field_name] = extracted_value
        save_documents(documents)
        
        return {
            "status": "success",
            "field_name": request.field_name,
            "extracted_value": extracted_value
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract field: {str(e)}")

@app.delete("/documents/{document_id}/fields/{field_name}")
async def delete_field(
    document_id: str,
    field_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete specific field from document"""
    documents = load_documents()
    document = next((doc for doc in documents if doc["id"] == document_id), None)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if field_name in document["extracted_data"]:
        del document["extracted_data"][field_name]
        save_documents(documents)
        return {"status": "success", "message": "Field deleted successfully"}
    
    raise HTTPException(status_code=404, detail="Field not found")

@app.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    """Get application settings"""
    settings = load_settings()
    return settings

@app.post("/settings")
async def update_settings(
    request: SettingsRequest,
    current_user: dict = Depends(require_admin)
):
    """Update application settings (admin only)"""
    settings = load_settings()
    settings["ai_model_name"] = request.ai_model_name
    save_settings(settings)
    return {"status": "success", "message": "Settings updated successfully"}

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Datasheet API endpoints

@app.get("/datasheets/")
async def get_datasheets(current_user: dict = Depends(get_current_user)):
    """Get all processed datasheets"""
    try:
        # Load datasheet index
        datasheet_index_path = "datasheet_index.json"
        if not os.path.exists(datasheet_index_path):
            return []
        
        with open(datasheet_index_path, 'r') as f:
            index_data = json.load(f)
        
        datasheets = []
        for datasheet_id, info in index_data.get("datasheets", {}).items():
            # Load the actual datasheet file
            datasheet_file = f"datasheets/{datasheet_id}.json"
            if os.path.exists(datasheet_file):
                with open(datasheet_file, 'r') as f:
                    datasheet_data = json.load(f)
                    
                # Combine index info with datasheet data
                datasheet_info = {
                    "id": datasheet_id,
                    "equipment_name": info.get("equipment_name", "Unknown"),
                    "document_id": info.get("document_id", ""),
                    "pages": info.get("pages", ""),
                    "created_at": info.get("created_at", ""),
                    "content": datasheet_data.get("content", {}),
                    "extracted_data": datasheet_data.get("extracted_data", {})
                }
                datasheets.append(datasheet_info)
        
        return datasheets
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load datasheets: {str(e)}")

@app.get("/datasheets/{datasheet_id}")
async def get_datasheet(
    datasheet_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific datasheet by ID"""
    try:
        datasheet_file = f"datasheets/{datasheet_id}.json"
        if not os.path.exists(datasheet_file):
            raise HTTPException(status_code=404, detail="Datasheet not found")
        
        with open(datasheet_file, 'r') as f:
            datasheet_data = json.load(f)
        
        return datasheet_data
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Datasheet not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load datasheet: {str(e)}")

@app.delete("/datasheets/{datasheet_id}")
async def delete_datasheet(
    datasheet_id: str,
    current_user: dict = Depends(require_admin)
):
    """Delete a datasheet (admin only)"""
    try:
        # Delete datasheet file
        datasheet_file = f"datasheets/{datasheet_id}.json"
        if os.path.exists(datasheet_file):
            os.remove(datasheet_file)
        
        # Update datasheet index
        datasheet_index_path = "datasheet_index.json"
        if os.path.exists(datasheet_index_path):
            with open(datasheet_index_path, 'r') as f:
                index_data = json.load(f)
            
            # Remove from datasheets
            if datasheet_id in index_data.get("datasheets", {}):
                del index_data["datasheets"][datasheet_id]
            
            # Update document datasheet list
            document_id = None
            for doc_id, doc_info in index_data.get("documents", {}).items():
                if datasheet_id in doc_info.get("datasheet_ids", []):
                    doc_info["datasheet_ids"].remove(datasheet_id)
                    doc_info["total_datasheets"] = len(doc_info["datasheet_ids"])
                    document_id = doc_id
                    break
            
            with open(datasheet_index_path, 'w') as f:
                json.dump(index_data, f, indent=2)
        
        return {"status": "success", "message": "Datasheet deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete datasheet: {str(e)}")

@app.post("/datasheets/process/")
async def process_document_to_datasheets(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Process a document to extract individual datasheets"""
    try:
        document_id = request.get("document_id")
        if not document_id:
            raise HTTPException(status_code=400, detail="Document ID is required")
        
        # Find the document
        documents = load_documents()
        document = next((doc for doc in documents if doc["id"] == document_id), None)
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Get the file path
        file_path = UPLOAD_DIR / document["stored_filename"]
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        # Process the document with datasheet splitter
        result = datasheet_splitter(str(file_path))
        
        # Load the generated datasheets
        datasheet_index_path = "datasheet_index.json"
        if os.path.exists(datasheet_index_path):
            with open(datasheet_index_path, 'r') as f:
                index_data = json.load(f)
            
            processed_datasheets = []
            doc_key = f"doc_{document_id}_{document['filename'].replace('.pdf', '')}"
            
            if doc_key in index_data.get("documents", {}):
                datasheet_ids = index_data["documents"][doc_key]["datasheet_ids"]
                
                for datasheet_id in datasheet_ids:
                    datasheet_file = f"datasheets/{datasheet_id}.json"
                    if os.path.exists(datasheet_file):
                        with open(datasheet_file, 'r') as f:
                            datasheet_data = json.load(f)
                        processed_datasheets.append(datasheet_data)
        
        return {
            "status": "success",
            "message": f"Successfully processed {len(processed_datasheets)} datasheets",
            "datasheets": processed_datasheets
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@app.post("/datasheets/{datasheet_id}/chat")
async def chat_with_datasheet(
    datasheet_id: str,
    request: DatasheetChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Chat with AI about a specific datasheet"""
    try:
        # Load datasheet
        datasheet_file = f"datasheets/{datasheet_id}.json"
        if not os.path.exists(datasheet_file):
            raise HTTPException(status_code=404, detail="Datasheet not found")
        
        with open(datasheet_file, 'r') as f:
            datasheet_data = json.load(f)
        
        # Prepare context for AI
        context = f"""
        Datasheet ID: {datasheet_id}
        Equipment Name: {datasheet_data.get('equipment_name', 'Unknown')}
        
        Content: {datasheet_data.get('content', {}).get('text', '')[:5000]}
        
        Extracted Data: {json.dumps(datasheet_data.get('extracted_data', {}), indent=2)}
        """
        
        # Generate AI response
        prompt = f"""
        You are an expert in analyzing technical datasheets. Based on the following datasheet content, please answer the user's question.
        
        {context}
        
        User Question: {request.message}
        
        Please provide a detailed and technical response based on the datasheet content.
        """
        
        response = model.generate_content(prompt)
        
        return DatasheetChatResponse(
            response=response.text,
            datasheet_id=datasheet_id,
            equipment_name=datasheet_data.get('equipment_name', 'Unknown')
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
