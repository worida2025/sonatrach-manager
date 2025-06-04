#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import extract_detailed_data_from_pdf
import json

def test_pdf_extraction():
    """Test the PDF extraction on the new file"""
    pdf_path = r'c:\Users\benna\Downloads\9952T-505-SP-1541-0001-7 (1).pdf'
    
    try:
        with open(pdf_path, 'rb') as file:
            content = file.read()
            print(f"Testing PDF: {pdf_path}")
            print(f"File size: {len(content)} bytes")
            
            # Extract data using our current function
            extracted_data = extract_detailed_data_from_pdf(content)
            
            print(f"\nExtracted {len(extracted_data)} fields:")
            print("=" * 50)
            
            for key, value in extracted_data.items():
                print(f"{key}: {str(value)[:200]}..." if len(str(value)) > 200 else f"{key}: {value}")
                print("-" * 30)
            
            if not extracted_data or len(extracted_data) == 0:
                print("⚠️  NO DATA EXTRACTED!")
                print("This indicates an issue with the extraction logic.")
            else:
                print(f"✅ Successfully extracted {len(extracted_data)} fields")
                
            # Save to file for inspection
            with open('test_extraction_results.json', 'w') as f:
                json.dump(extracted_data, f, indent=2)
            print(f"\nResults saved to test_extraction_results.json")
                
    except Exception as e:
        print(f"Error during extraction: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_pdf_extraction()
