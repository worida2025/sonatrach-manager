import json
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import pdfplumber
import PyPDF2
import io
from pdfminer.high_level import extract_text
import fitz  # PyMuPDF for better PDF handling

# Configuration paths
BASE_DIR = Path(__file__).parent
DATASHEETS_DIR = BASE_DIR / "datasheets"
DATASHEET_INDEX_FILE = BASE_DIR / "datasheet_index.json"

class DatasheetSplitter:
    def __init__(self):
        self.datasheets_dir = DATASHEETS_DIR
        self.datasheets_dir.mkdir(exist_ok=True)
        
    def load_datasheet_index(self) -> Dict:
        """Load or create datasheet index"""
        try:
            if DATASHEET_INDEX_FILE.exists():
                with open(DATASHEET_INDEX_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                return {"documents": {}, "datasheets": {}}
        except Exception as e:
            print(f"Error loading datasheet index: {e}")
            return {"documents": {}, "datasheets": {}}
    
    def save_datasheet_index(self, index: Dict):
        """Save datasheet index"""
        try:
            with open(DATASHEET_INDEX_FILE, 'w', encoding='utf-8') as f:
                json.dump(index, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving datasheet index: {e}")
    
    def detect_datasheet_pages(self, pdf_content: bytes) -> List[Tuple[int, int, str]]:
        """
        Detect individual datasheets within a PDF document
        Returns list of (start_page, end_page, equipment_name) tuples
        """
        datasheets = []
        
        try:
            # Use PyMuPDF for better page analysis
            pdf_doc = fitz.open(stream=pdf_content, filetype="pdf")
            
            current_datasheet_start = None
            current_equipment = None
            
            for page_num in range(len(pdf_doc)):
                page = pdf_doc[page_num]
                text = page.get_text()
                
                # Look for datasheet indicators
                datasheet_indicators = self._find_datasheet_indicators(text)
                
                if datasheet_indicators:
                    # If we have a current datasheet, close it
                    if current_datasheet_start is not None:
                        datasheets.append((
                            current_datasheet_start, 
                            page_num - 1, 
                            current_equipment or f"Equipment_{len(datasheets) + 1}"
                        ))
                    
                    # Start new datasheet
                    current_datasheet_start = page_num
                    current_equipment = datasheet_indicators.get('equipment_name', f"Equipment_{len(datasheets) + 1}")
            
            # Close the last datasheet
            if current_datasheet_start is not None:
                datasheets.append((
                    current_datasheet_start, 
                    len(pdf_doc) - 1, 
                    current_equipment or f"Equipment_{len(datasheets) + 1}"
                ))
            
            pdf_doc.close()
            
            # If no specific datasheets detected, treat each page as a potential datasheet
            if not datasheets:
                datasheets = self._split_by_pages(pdf_content)
                
        except Exception as e:
            print(f"Error detecting datasheets: {e}")
            # Fallback: split by pages
            datasheets = self._split_by_pages(pdf_content)
        
        return datasheets
    
    def _find_datasheet_indicators(self, text: str) -> Dict[str, str]:
        """Find indicators that suggest start of a new datasheet"""
        indicators = {}
        
        # Common datasheet patterns
        patterns = {
            'title_patterns': [
                r'(?i)data\s*sheet',
                r'(?i)specification\s*sheet',
                r'(?i)technical\s*data',
                r'(?i)product\s*data',
                r'(?i)equipment\s*data'
            ],
            'equipment_patterns': [
                r'(?i)model\s*(?:number|no\.?):\s*([A-Z0-9\-]+)',
                r'(?i)part\s*(?:number|no\.?):\s*([A-Z0-9\-]+)',
                r'(?i)serial\s*(?:number|no\.?):\s*([A-Z0-9\-]+)',
                r'(?i)tag\s*(?:number|no\.?):\s*([A-Z0-9\-]+)'
            ]
        }
        
        # Check for title patterns
        for pattern in patterns['title_patterns']:
            if re.search(pattern, text):
                indicators['has_datasheet_title'] = True
                break
        
        # Extract equipment name/model
        for pattern in patterns['equipment_patterns']:
            match = re.search(pattern, text)
            if match:
                indicators['equipment_name'] = match.group(1)
                break
        
        # Look for manufacturer information
        manufacturer_pattern = r'(?i)manufacturer:\s*([A-Za-z0-9\s&,.-]+?)(?:\n|$)'
        manufacturer_match = re.search(manufacturer_pattern, text)
        if manufacturer_match:
            indicators['manufacturer'] = manufacturer_match.group(1).strip()
        
        return indicators
    
    def _split_by_pages(self, pdf_content: bytes) -> List[Tuple[int, int, str]]:
        """Fallback method: split document into individual pages as datasheets"""
        try:
            pdf_doc = fitz.open(stream=pdf_content, filetype="pdf")
            datasheets = []
            
            for page_num in range(len(pdf_doc)):
                datasheets.append((page_num, page_num, f"Datasheet_Page_{page_num + 1}"))
            
            pdf_doc.close()
            return datasheets
            
        except Exception as e:
            print(f"Error in page splitting: {e}")
            return [(0, 0, "Datasheet_1")]  # Single datasheet fallback
    
    def extract_datasheet_content(self, pdf_content: bytes, start_page: int, end_page: int) -> Dict:
        """Extract content from specific pages of PDF"""
        try:
            pdf_doc = fitz.open(stream=pdf_content, filetype="pdf")
            
            content = {
                'text': '',
                'images': [],
                'tables': [],
                'metadata': {}
            }
            
            for page_num in range(start_page, end_page + 1):
                if page_num < len(pdf_doc):
                    page = pdf_doc[page_num]
                    
                    # Extract text
                    page_text = page.get_text()
                    content['text'] += f"\n--- Page {page_num + 1} ---\n{page_text}"
                    
                    # Extract tables (basic implementation)
                    tables = page.find_tables()
                    for table in tables:
                        try:
                            table_data = table.extract()
                            content['tables'].append({
                                'page': page_num + 1,
                                'data': table_data
                            })
                        except:
                            pass
            
            pdf_doc.close()
            return content
            
        except Exception as e:
            print(f"Error extracting datasheet content: {e}")
            return {'text': '', 'images': [], 'tables': [], 'metadata': {}}
    
    def save_individual_datasheet(self, content: Dict, equipment_name: str, document_id: str) -> str:
        """Save individual datasheet content"""
        try:
            datasheet_id = f"{document_id}_{equipment_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            datasheet_file = self.datasheets_dir / f"{datasheet_id}.json"
            
            datasheet_data = {
                'id': datasheet_id,
                'equipment_name': equipment_name,
                'document_id': document_id,
                'created_at': datetime.now().isoformat(),
                'content': content,
                'parsed_fields': self._parse_technical_fields(content['text']),
                'chat_history': []
            }
            
            with open(datasheet_file, 'w', encoding='utf-8') as f:
                json.dump(datasheet_data, f, indent=2, ensure_ascii=False)
            
            return datasheet_id
            
        except Exception as e:
            print(f"Error saving datasheet: {e}")
            return ""
    
    def _parse_technical_fields(self, text: str) -> Dict[str, str]:
        """Parse common technical fields from datasheet text"""
        fields = {}
        
        # Common field patterns for technical datasheets
        patterns = {
            'Model': r'(?i)model\s*(?:number|no\.?):\s*([A-Z0-9\-\.\s]+?)(?:\n|$)',
            'Manufacturer': r'(?i)manufacturer:\s*([A-Za-z0-9\s&,.-]+?)(?:\n|$)',
            'Serial Number': r'(?i)serial\s*(?:number|no\.?):\s*([A-Z0-9\-]+)',
            'Flow Rate': r'(?i)flow\s*rate:\s*([0-9.,]+\s*[A-Za-z/]+)',
            'Pressure': r'(?i)pressure:\s*([0-9.,]+\s*[A-Za-z/]+)',
            'Temperature': r'(?i)temperature:\s*([0-9.,\-°CF\s]+)',
            'Power': r'(?i)power:\s*([0-9.,]+\s*[A-Za-z/]+)',
            'Voltage': r'(?i)voltage:\s*([0-9.,]+\s*[Vv])',
            'Material': r'(?i)material:\s*([A-Za-z0-9\s,.-]+?)(?:\n|$)',
            'Size': r'(?i)size:\s*([0-9.,\s"x\-A-Za-z]+)',
            'Weight': r'(?i)weight:\s*([0-9.,]+\s*[A-Za-z]+)'
        }
        
        for field_name, pattern in patterns.items():
            match = re.search(pattern, text)
            if match:
                fields[field_name] = match.group(1).strip()
        
        return fields
    
    def process_document(self, pdf_content: bytes, filename: str) -> Dict:
        """
        Process a document and split it into individual datasheets
        
        Args:
            pdf_content: PDF file content as bytes
            filename: Original filename
            
        Returns:
            Dictionary containing processing results and datasheet IDs
        """
        try:
            # Generate document ID
            document_id = f"doc_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename.replace('.pdf', '')}"
            
            # Load index
            index = self.load_datasheet_index()
            
            # Detect datasheets
            datasheets = self.detect_datasheet_pages(pdf_content)
            
            if not datasheets:
                return {
                    'status': 'error',
                    'message': 'No datasheets detected in document',
                    'datasheets': []
                }
            
            processed_datasheets = []
            
            for start_page, end_page, equipment_name in datasheets:
                # Extract content
                content = self.extract_datasheet_content(pdf_content, start_page, end_page)
                
                # Save individual datasheet
                datasheet_id = self.save_individual_datasheet(content, equipment_name, document_id)
                
                if datasheet_id:
                    datasheet_info = {
                        'id': datasheet_id,
                        'equipment_name': equipment_name,
                        'pages': f"{start_page + 1}-{end_page + 1}",
                        'fields_found': len(self._parse_technical_fields(content['text']))
                    }
                    processed_datasheets.append(datasheet_info)
                    
                    # Update index
                    index['datasheets'][datasheet_id] = {
                        'document_id': document_id,
                        'equipment_name': equipment_name,
                        'pages': f"{start_page + 1}-{end_page + 1}",
                        'created_at': datetime.now().isoformat()
                    }
            
            # Update document index
            index['documents'][document_id] = {
                'filename': filename,
                'processed_at': datetime.now().isoformat(),
                'total_datasheets': len(processed_datasheets),
                'datasheet_ids': [ds['id'] for ds in processed_datasheets]
            }
            
            # Save index
            self.save_datasheet_index(index)
            
            return {
                'status': 'success',
                'message': f'Successfully processed {len(processed_datasheets)} datasheets',
                'document_id': document_id,
                'datasheets': processed_datasheets
            }
            
        except Exception as e:
            print(f"Error processing document: {e}")
            return {
                'status': 'error',
                'message': f'Error processing document: {str(e)}',
                'datasheets': []
            }
    
    def get_datasheet(self, datasheet_id: str) -> Dict:
        """Get a specific datasheet by ID"""
        try:
            datasheet_file = self.datasheets_dir / f"{datasheet_id}.json"
            if datasheet_file.exists():
                with open(datasheet_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            print(f"Error getting datasheet: {e}")
            return {}
    
    def get_all_datasheets(self) -> List[Dict]:
        """Get all processed datasheets"""
        try:
            index = self.load_datasheet_index()
            datasheets = []
            
            for datasheet_id, info in index['datasheets'].items():
                datasheet_data = self.get_datasheet(datasheet_id)
                if datasheet_data:
                    datasheets.append({
                        'id': datasheet_id,
                        'equipment_name': info['equipment_name'],
                        'pages': info['pages'],
                        'created_at': info['created_at'],
                        'fields_count': len(datasheet_data.get('parsed_fields', {}))
                    })
            
            return sorted(datasheets, key=lambda x: x['created_at'], reverse=True)
        except Exception as e:
            print(f"Error getting all datasheets: {e}")
            return []
    
    def update_datasheet_chat(self, datasheet_id: str, message: str, response: str) -> bool:
        """Update datasheet with chat history"""
        try:
            datasheet = self.get_datasheet(datasheet_id)
            if not datasheet:
                return False
            
            chat_entry = {
                'timestamp': datetime.now().isoformat(),
                'message': message,
                'response': response
            }
            
            if 'chat_history' not in datasheet:
                datasheet['chat_history'] = []
            
            datasheet['chat_history'].append(chat_entry)
            
            # Save updated datasheet
            datasheet_file = self.datasheets_dir / f"{datasheet_id}.json"
            with open(datasheet_file, 'w', encoding='utf-8') as f:
                json.dump(datasheet, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception as e:
            print(f"Error updating datasheet chat: {e}")
            return False

# Global instance
datasheet_splitter = DatasheetSplitter()
