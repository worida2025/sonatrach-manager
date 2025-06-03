import json
import re
from pathlib import Path
from typing import List, Tuple, Dict
from datetime import datetime
from pdfminer.high_level import extract_text

# Configuration paths
BASE_DIR = Path(__file__).parent
EXTRACTED_DATA_FILE = BASE_DIR / "extracted_data.json"
UPLOAD_DIR = BASE_DIR / "uploads"

def load_json_file(file_path: Path) -> Dict:
    """Load JSON file with default structure if it doesn't exist"""
    try:
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        else:
            # Create default structure
            default_data = {
                "files": {"pid": {}},
                "instruments": {},
                "acronyms_to_types": {},
                "not_tags": []
            }
            save_json_file(file_path, default_data)
            return default_data
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        return {
            "files": {"pid": {}},
            "instruments": {},
            "acronyms_to_types": {},
            "not_tags": []
        }

def save_json_file(file_path: Path, data: Dict):
    """Save data to JSON file"""
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving JSON file: {e}")

def load_reference_data():
    """Load tag extraction reference data"""
    data = load_json_file(EXTRACTED_DATA_FILE)
    list_tags = dict(sorted(data["acronyms_to_types"].items(), key=lambda x: (-len(x[0]), x[0])))
    return data, list(list_tags.keys()), data["not_tags"]

def repair_data_structure(data):
    """Repair data structure inconsistencies"""
    repaired = False
    log_lines = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_lines.append(f"\n🛠️ [{now}] Début de vérification de structure")

    valid_file_keys = set(data["files"]["pid"].keys())

    # Remove orphaned instruments
    orphans = [key for key in data["instruments"] if key not in valid_file_keys]
    for orphan_key in orphans:
        del data["instruments"][orphan_key]
        log_lines.append(f"❌ Instruments orphelins supprimés : {orphan_key}")
        repaired = True

    # Remove files without instruments
    empty_files = [k for k in data["files"]["pid"]
                   if k not in data["instruments"] or not data["instruments"][k]]
    for empty_key in empty_files:
        del data["files"]["pid"][empty_key]
        log_lines.append(f"⚠️ Fichier PDF sans instrument supprimé : {empty_key}")
        repaired = True

    if not repaired:
        log_lines.append("✅ Aucune incohérence détectée")
    else:
        log_lines.append("🔁 Structure réparée avec succès")

    # Save log
    logs_dir = BASE_DIR / "logs"
    logs_dir.mkdir(exist_ok=True)
    log_path = logs_dir / "repair_log.txt"

    with open(log_path, "a", encoding="utf-8") as log_file:
        for line in log_lines:
            log_file.write(line + "\n")

    for line in log_lines:
        print(line)

    return data

def extract_text_from_pdf(pdf_path: Path) -> List[str]:
    """Extract text from PDF and split into words"""
    try:
        raw_text = extract_text(pdf_path)
        return raw_text.split()
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return []

def extract_text_from_content(pdf_content: bytes) -> List[str]:
    """Extract text from PDF content and split into words"""
    try:
        # Save content to temporary file
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_file.write(pdf_content)
            temp_path = Path(temp_file.name)
        
        try:
            raw_text = extract_text(temp_path)
            return raw_text.split()
        finally:
            # Clean up temporary file
            temp_path.unlink()
    except Exception as e:
        print(f"Error extracting text from PDF content: {e}")
        return []

def extract_possible_tags(text_list: List[str], not_tags: List[str], list_tags: List[str]) -> Tuple[List[str], List[str]]:
    """Extract possible tags from text"""
    pattern_accronym = r"^[A-Z]{1,6}$"
    pattern_id_tag = r"^[0-9]{4}[A-Z]?$"

    full_tag_list = []
    new_acronyms = []

    for i, word in enumerate(text_list):
        if 0 < len(word) <= 6:
            if re.fullmatch(pattern_accronym, word) and word not in not_tags:
                if i + 1 < len(text_list) and re.fullmatch(pattern_id_tag, text_list[i + 1]):
                    accronym = word
                    id_tag = text_list[i + 1]
                    full_tag = f"{accronym}-{id_tag}"
                    full_tag_list.append(full_tag)

                    if accronym not in list_tags:
                        new_acronyms.append(accronym)
                        list_tags.append(accronym)

    return full_tag_list, new_acronyms

def clean_final_tags(full_tag_list: List[str], data: Dict) -> List[str]:
    """Clean final tags by removing false positives"""
    return [tag for tag in full_tag_list if tag.split("-")[0] not in data["not_tags"]]

def save_pdf_data(data: Dict, pdf_filename: str, final_tags: List[str]) -> str:
    """Save PDF data and return file key"""
    # Extract unit code from filename (assumes format like "unit-code-...")
    parts = pdf_filename.split("-")
    unit_code = parts[1] if len(parts) > 1 else "UNKNOWN"
    
    file_key = "file_" + str(len(data["files"]["pid"]) + 1)

    data["files"]["pid"][file_key] = {
        "path": pdf_filename,
        "unit": unit_code,
        "number_of_instruments": len(final_tags)
    }

    for instrument in final_tags:
        tag = unit_code + "-" + instrument
        accronym = instrument.split("-")[0]
        instrument_entry = {
            "tag": tag,
            "tag_less_unit": instrument,
            "accronyme": accronym,
            "datasheet": {
                "file_id": "",
                "pages": []
            }
        }
        if file_key not in data["instruments"]:
            data["instruments"][file_key] = []
        data["instruments"][file_key].append(instrument_entry)

    print(f"\n✅ Le fichier {pdf_filename} a été ajouté avec {len(final_tags)} instruments.")
    return file_key

def process_pdf_for_tags(pdf_content: bytes, filename: str) -> Dict:
    """
    Process a PDF for tag extraction and return the results
    
    Args:
        pdf_content: PDF file content as bytes
        filename: Original filename
        
    Returns:
        Dictionary containing extracted tags and processing info
    """
    data, list_tags, not_tags = load_reference_data()
    
    # Repair data structure if needed
    data = repair_data_structure(data)
    
    # Check if file already processed
    if any(filename == file_data["path"] for file_data in data["files"]["pid"].values()):
        return {
            "status": "already_processed",
            "message": f"File {filename} already processed",
            "tags": [],
            "new_acronyms": []
        }
    
    # Extract text from PDF content
    text_list = extract_text_from_content(pdf_content)
    
    if not text_list:
        return {
            "status": "error",
            "message": "Could not extract text from PDF",
            "tags": [],
            "new_acronyms": []
        }
    
    # Extract possible tags
    full_tag_list, new_acronyms = extract_possible_tags(text_list, not_tags, list_tags)
    
    # Clean tags
    final_tags = clean_final_tags(full_tag_list, data)
    
    # Auto-approve all new acronyms for now (can be made configurable)
    # In production, you might want to implement manual validation
    for acronym in new_acronyms:
        if acronym not in data["acronyms_to_types"]:
            data["acronyms_to_types"][acronym] = ""
    
    # Save data if tags found
    file_key = None
    if final_tags:
        file_key = save_pdf_data(data, filename, final_tags)
        save_json_file(EXTRACTED_DATA_FILE, data)
    
    return {
        "status": "success",
        "message": f"Processed {filename} - found {len(final_tags)} tags",
        "tags": final_tags,
        "new_acronyms": new_acronyms,
        "file_key": file_key,
        "total_words_analyzed": len(text_list)
    }

def get_tag_extraction_stats() -> Dict:
    """Get statistics about tag extraction"""
    try:
        data = load_json_file(EXTRACTED_DATA_FILE)
        
        total_files = len(data["files"]["pid"])
        total_instruments = sum(len(instruments) for instruments in data["instruments"].values())
        total_acronyms = len(data["acronyms_to_types"])
        total_false_positives = len(data["not_tags"])
        
        return {
            "total_files_processed": total_files,
            "total_instruments_found": total_instruments,
            "total_known_acronyms": total_acronyms,
            "total_false_positives": total_false_positives
        }
    except Exception as e:
        print(f"Error getting stats: {e}")
        return {
            "total_files_processed": 0,
            "total_instruments_found": 0,
            "total_known_acronyms": 0,
            "total_false_positives": 0
        }

def get_extracted_tags_for_file(filename: str) -> List[Dict]:
    """Get extracted tags for a specific file"""
    try:
        data = load_json_file(EXTRACTED_DATA_FILE)
        
        # Find the file
        file_key = None
        for key, file_info in data["files"]["pid"].items():
            if file_info["path"] == filename:
                file_key = key
                break
        
        if not file_key or file_key not in data["instruments"]:
            return []
        
        return data["instruments"][file_key]
    except Exception as e:
        print(f"Error getting tags for file: {e}")
        return []
