#!/usr/bin/env python3
"""
Add manual question matches to a practice test mapping JSON.

Usage:
    python3 merge_manual_matches_v2.py <test_number> <variant>

Edit MANUAL_MATCHES below for the test/variant before running.
"""

import json
import sys
from pathlib import Path


# Edit this dict to add manual matches for a given (test_number, variant)
MANUAL_MATCHES = {
    (5, 'easy'): {
        # questionNumber -> uId (uId is Question.external_id, real CB uId or synthetic)
        11: '3959103c-3ee9-4f6a-a1bf-1b53f30a1212',  # Looking Back on Girlhood
        14: 'b828677b-da71-44cd-b234-a5581c01f098',  # Wiggins / jumping spiders
        37: 'pt5-easy-q37',                          # Average Clothing Prices (synthetic)
        47: '4c9e08d1-0b33-4578-87ce-d400cbfa5b90',  # African American global explorers
        68: 'dd42f2b3-ecef-48a2-8066-fd2f177a54ff',  # rational function graph
    },
    (5, 'hard'): {
        # questionNumber -> uId
        28: 'pt5-hard-q28',                          # Mary Engle Pennington (synthetic)
        30: 'pt5-hard-q30',                          # Behavioral psychology (synthetic)
        35: 'pt5-hard-q35',                          # Automate paintings (synthetic)
        40: 'c6cdbfe0-cf01-4760-b77d-51fcf96a6453',  # 1919 poem by Marianne Moore
        44: 'pt5-hard-q44',                          # Vermeer Milkmaid (synthetic)
        45: 'pt5-hard-q45',                          # Transparent/translucent (synthetic)
        54: 'pt5-hard-q54',                          # Government classification (synthetic)
    },
}


def determine_module(question_num: int):
    if question_num <= 27:
        return 'rw', 1
    elif question_num <= 54:
        return 'rw', 2
    elif question_num <= 76:
        return 'math', 1
    return 'math', 2


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 merge_manual_matches_v2.py <test_number> <variant>")
        sys.exit(1)

    test_number = int(sys.argv[1])
    variant = sys.argv[2].lower()
    variant_long = 'easier' if variant == 'easy' else 'harder'

    matches = MANUAL_MATCHES.get((test_number, variant), {})
    if not matches:
        print(f"No manual matches defined for ({test_number}, {variant})")
        sys.exit(0)

    mapping_dir = Path(__file__).parent.parent / "data" / "practice_test_mappings"
    mapping_path = mapping_dir / f"practice_test_{test_number}_modules_1_2_{variant}.json"

    with open(mapping_path) as f:
        mapping = json.load(f)

    added = 0
    for q_num, uid in matches.items():
        section, module_num = determine_module(q_num)
        if module_num == 1:
            key = f"{section}_module_1"
        else:
            key = f"{section}_module_2_{variant_long}"

        if uid in mapping[key]:
            print(f"Q{q_num} already in {key}, skipping")
            continue

        mapping[key].append(uid)
        added += 1

        # Update the matches log
        for m in mapping.get('matches', []):
            if m.get('questionNumber') == q_num and not m.get('uId'):
                m['uId'] = uid
                m['similarity'] = 1.0  # manual = treated as perfect
                m['manual'] = True
                m.pop('error', None)
                break

        print(f"Added Q{q_num} -> {uid} to {key}")

    with open(mapping_path, 'w') as f:
        json.dump(mapping, f, indent=2)

    print(f"\nAdded {added} manual matches to {mapping_path.name}")
    print(f"\nFinal counts:")
    print(f"  RW Module 1: {len(mapping['rw_module_1'])}")
    print(f"  RW Module 2 ({variant_long}): {len(mapping[f'rw_module_2_{variant_long}'])}")
    print(f"  Math Module 1: {len(mapping['math_module_1'])}")
    print(f"  Math Module 2 ({variant_long}): {len(mapping[f'math_module_2_{variant_long}'])}")


if __name__ == "__main__":
    main()
