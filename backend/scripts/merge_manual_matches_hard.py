#!/usr/bin/env python3
"""
Merge manually identified matches into the HARD practice test mapping.
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
    manual_path = Path(__file__).parent / "manual_matches_hard.json"
    with open(manual_path) as f:
        manual_matches = json.load(f)

    # Load existing mapping
    mapping_path = Path(__file__).parent.parent / "data" / "practice_test_mappings" / "practice_test_4_modules_1_2_hard.json"
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
            key = f"{section}_module_2_harder"

        # Check if already exists
        if uid in mapping[key]:
            print(f"✓ Q{q_num}: Already in mapping")
            continue

        # Add to mapping
        mapping[key].append(uid)

        # Update matches array
        for i, match in enumerate(mapping['matches']):
            if match['questionNumber'] == q_num:
                mapping['matches'][i] = {
                    "questionNumber": q_num,
                    "section": section,
                    "module": module_num,
                    "uId": uid,
                    "similarity": 1.0,
                    "preview": f"Manually matched Q{q_num}",
                    "manual": True
                }
                break
        else:
            # Not found, append new
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
    total_matched = sum(len(mapping[key]) for key in ['rw_module_1', 'rw_module_2_harder', 'math_module_1', 'math_module_2_harder'])
    print(f"\nTotal matched: {total_matched}/98")
    print(f"RW Module 1: {len(mapping['rw_module_1'])} (from easy variant)")
    print(f"RW Module 2 (harder): {len(mapping['rw_module_2_harder'])}")
    print(f"Math Module 1: {len(mapping['math_module_1'])} (from easy variant)")
    print(f"Math Module 2 (harder): {len(mapping['math_module_2_harder'])}")


if __name__ == "__main__":
    main()
