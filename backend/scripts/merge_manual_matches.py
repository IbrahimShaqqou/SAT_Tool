#!/usr/bin/env python3
"""
Merge manually identified matches into the practice test mapping.
"""

import json
from pathlib import Path


def determine_module(question_num: int):
    """Determine section and module based on question number."""
    if question_num <= 27:
        return 'rw', 1
    elif question_num <= 54:
        return 'rw', 2
    elif question_num <= 76:
        return 'math', 1
    else:
        return 'math', 2


def main():
    # Load manual matches
    manual_path = Path(__file__).parent / "manual_matches.json"
    with open(manual_path) as f:
        manual_matches = json.load(f)

    # Load existing mapping
    mapping_path = Path(__file__).parent.parent / "data" / "practice_test_mappings" / "practice_test_4_modules_1_2_easy.json"
    with open(mapping_path) as f:
        mapping = json.load(f)

    # Add manual matches
    for q_num_str, uid in manual_matches.items():
        if uid is None:
            print(f"⚠️  Q{q_num_str}: No manual match provided")
            continue

        q_num = int(q_num_str)
        section, module_num = determine_module(q_num)

        # Determine key
        if module_num == 1:
            key = f"{section}_module_1"
        else:
            key = f"{section}_module_2_easier"

        # Check if already exists
        if uid in mapping[key]:
            print(f"✓ Q{q_num}: Already in mapping")
            continue

        # Add to mapping
        mapping[key].append(uid)

        # Update matches array
        mapping['matches'].append({
            "questionNumber": q_num,
            "section": section,
            "module": module_num,
            "uId": uid,
            "similarity": 1.0,
            "preview": f"Manually matched Q{q_num}",
            "manual": True
        })

        print(f"✓ Q{q_num}: Added manual match {uid}")

    # Save updated mapping
    with open(mapping_path, 'w') as f:
        json.dump(mapping, f, indent=2)

    print(f"\n✓ Updated mapping saved to: {mapping_path}")

    # Print new summary
    total_matched = sum(len(mapping[key]) for key in ['rw_module_1', 'rw_module_2_easier', 'math_module_1', 'math_module_2_easier'])
    print(f"\nTotal matched: {total_matched}/98")


if __name__ == "__main__":
    main()
