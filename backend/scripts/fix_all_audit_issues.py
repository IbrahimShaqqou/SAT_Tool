#!/usr/bin/env python3
"""
Master Fix Script for All Audit Issues

Runs all fix scripts to address issues found in the comprehensive audit.
"""

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent


def run_script(script_name: str, description: str) -> bool:
    """Run a fix script and report results."""
    print("\n" + "=" * 70)
    print(f"RUNNING: {description}")
    print("=" * 70)

    script_path = SCRIPTS_DIR / script_name

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=False,
            text=True
        )

        if result.returncode == 0:
            print(f"\n✓ {description} completed successfully")
            return True
        else:
            print(f"\n✗ {description} failed with code {result.returncode}")
            return False

    except Exception as e:
        print(f"\n✗ Error running {description}: {e}")
        return False


def main():
    """Run all fix scripts in sequence."""
    print("=" * 70)
    print("COMPREHENSIVE FIX SCRIPT - All Audit Issues")
    print("=" * 70)
    print("\nThis script will fix all issues found in the question audit:")
    print("  1. API serialization bugs (Q.G., BOU, P.B.) - ALREADY FIXED IN CODE")
    print("  2. LaTeX rendering issues (H.A., H.E., H.B.) - 58 questions")
    print("  3. HTML parsing errors (H.E.) - 15 questions")
    print("  4. Oversized images (Q.D.) - 19 questions")
    print("  5. Missing image attributes (S.A.) - 3 questions")
    print()

    input("Press Enter to continue or Ctrl+C to cancel...")

    results = []

    # Fix 1: API bugs are already fixed in code changes
    print("\n" + "=" * 70)
    print("FIX #1: API Serialization Bugs")
    print("=" * 70)
    print("✓ Already fixed in backend/app/schemas/question.py")
    print("✓ Already fixed in backend/app/api/v1/questions.py")
    print("\nBackend needs to be restarted for changes to take effect.")
    results.append(("API Serialization", True))

    # Fix 2: LaTeX rendering
    results.append((
        "LaTeX Rendering",
        run_script("fix_latex_rendering.py", "Fix LaTeX Rendering Issues")
    ))

    # Fix 3: HTML parsing
    results.append((
        "HTML Parsing",
        run_script("fix_html_parsing.py", "Fix HTML Parsing Errors")
    ))

    # Fix 4: Oversized images
    results.append((
        "Image Optimization",
        run_script("optimize_images.py", "Optimize Oversized Images")
    ))

    # Fix 5: Image attributes
    results.append((
        "Image Attributes",
        run_script("fix_image_attributes.py", "Add Image Width/Height Attributes")
    ))

    # Summary
    print("\n" + "=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)

    success_count = sum(1 for _, success in results if success)
    total_count = len(results)

    for name, success in results:
        status = "✓" if success else "✗"
        print(f"{status} {name}")

    print(f"\n{success_count}/{total_count} fixes completed successfully")

    if success_count == total_count:
        print("\n🎉 All audit issues have been fixed!")
        print("\nNext steps:")
        print("  1. Restart the backend server to apply API changes")
        print("  2. Test the affected skills in the frontend")
        print("  3. Run a verification audit on the fixed skills")
    else:
        print("\n⚠️  Some fixes failed. Check the output above for details.")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
