"""
Test script for the new extraction functions
"""
import re
from typing import Dict

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

# Test with sample text
test_text = """
PROCESS & INSTRUMENTATION DIAGRAM
Drawing No: PID-001
Revision: A

GENERAL NOTES:
1. All instruments shall comply with ISA standards
2. Pressure instruments calibrated to 0-300 PSI
3. Temperature instruments calibrated to 0-400°F

NOTES:
- Safety valves to be tested annually
- Flow meters require monthly calibration
- All electrical equipment Class 1 Div 2

Equipment List:
PI1001 - Pressure Indicator
FT2001 - Flow Transmitter  
TI3001 - Temperature Indicator
PV4001 - Pressure Valve
CV5001 - Control Valve
AB1234 - Special Equipment
XY5678 - Custom Device
"""

print("Testing Two Letter Four Number Pattern Extraction:")
patterns = extract_two_letter_four_number_patterns(test_text)
for key, value in patterns.items():
    print(f"{key}: {value}")

print("\nTesting Enhanced Notes Extraction:")
notes = extract_enhanced_notes(test_text)
for key, value in notes.items():
    print(f"{key}:")
    print(f"{value}")
    print("-" * 40)
