#!/usr/bin/env python3
"""
Test script for tag extraction functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from tag_extraction import (
    load_reference_data, 
    extract_possible_tags, 
    clean_final_tags, 
    get_tag_extraction_stats
)

def test_tag_extraction():
    print("🧪 Testing Tag Extraction Functionality")
    print("=" * 50)
    
    # Test 1: Load reference data
    print("\n1. Testing reference data loading...")
    try:
        data, list_tags, not_tags = load_reference_data()
        print(f"✅ Loaded {len(list_tags)} known acronyms")
        print(f"✅ Loaded {len(not_tags)} false positives")
        print(f"✅ Reference data structure: {list(data.keys())}")
    except Exception as e:
        print(f"❌ Error loading reference data: {e}")
        return False
    
    # Test 2: Tag extraction from sample text
    print("\n2. Testing tag extraction from sample text...")
    sample_text = [
        "This", "is", "a", "PID", "document", "with", "instruments",
        "FT", "1001", "measures", "flow", "rate",
        "PT", "2001", "measures", "pressure",
        "TT", "3001A", "measures", "temperature",
        "LT", "4001", "indicates", "level",
        "AI", "5001", "analog", "input",
        "DI", "6001", "digital", "input",
        "INVALID", "9999", "should", "not", "match"
    ]
    
    try:
        full_tag_list, new_acronyms = extract_possible_tags(sample_text, not_tags, list_tags.copy())
        print(f"✅ Found {len(full_tag_list)} potential tags: {full_tag_list}")
        print(f"✅ Found {len(new_acronyms)} new acronyms: {new_acronyms}")
        
        final_tags = clean_final_tags(full_tag_list, data)
        print(f"✅ Final cleaned tags: {final_tags}")
        
    except Exception as e:
        print(f"❌ Error in tag extraction: {e}")
        return False
    
    # Test 3: Statistics
    print("\n3. Testing statistics retrieval...")
    try:
        stats = get_tag_extraction_stats()
        print(f"✅ Current statistics: {stats}")
    except Exception as e:
        print(f"❌ Error getting statistics: {e}")
        return False
    
    print("\n🎉 All tests passed successfully!")
    return True

if __name__ == "__main__":
    success = test_tag_extraction()
    sys.exit(0 if success else 1)
