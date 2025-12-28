#!/usr/bin/env python3
"""
IRT Parameter Calibration Script

Initializes IRT parameters (a, b, c) for all questions in the database
based on their existing metadata (difficulty level, score_band_range).
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.services.irt_calibration import (
    initialize_parameters_sql,
    get_calibration_stats,
)


def main():
    """Run IRT parameter calibration."""
    print("=" * 60)
    print("IRT Parameter Calibration")
    print("=" * 60)

    # Create database connection
    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # Get current stats
        print("\nCurrent calibration status:")
        stats_before = get_calibration_stats(db)
        print(f"  Total questions: {stats_before['total_questions']}")
        print(f"  Fully calibrated: {stats_before['coverage']['fully_calibrated']} "
              f"({stats_before['percentages']['fully_calibrated']}%)")

        if stats_before['percentages']['fully_calibrated'] == 100:
            print("\nAll questions already calibrated!")
            print("Run with --force to recalibrate.")
            return

        # Run calibration
        print("\nRunning calibration...")
        results = initialize_parameters_sql(db)

        print("\nCalibration results:")
        for key, count in results.items():
            if count > 0:
                print(f"  {key}: {count} rows updated")

        # Get final stats
        print("\nFinal calibration status:")
        stats_after = get_calibration_stats(db)
        print(f"  Fully calibrated: {stats_after['coverage']['fully_calibrated']} "
              f"({stats_after['percentages']['fully_calibrated']}%)")

        if stats_after['parameter_ranges']['b']['min'] is not None:
            print(f"\nDifficulty (b) range: "
                  f"{stats_after['parameter_ranges']['b']['min']:.2f} to "
                  f"{stats_after['parameter_ranges']['b']['max']:.2f}")
            print(f"Discrimination (a) range: "
                  f"{stats_after['parameter_ranges']['a']['min']:.2f} to "
                  f"{stats_after['parameter_ranges']['a']['max']:.2f}")

        print("\nCalibration complete!")

    except Exception as e:
        print(f"\nError during calibration: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
