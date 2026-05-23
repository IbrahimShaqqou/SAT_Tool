#!/usr/bin/env python3
"""
Bluebook Screenshot Capture Tool

Press Cmd+Shift+C to capture a screenshot of the current question.
Screenshots are auto-numbered and saved for later processing.

Usage:
    python3 screenshot_capture.py

Then navigate through Bluebook questions, pressing Cmd+Shift+C on each.
Press Cmd+Q to quit.
"""

import os
import subprocess
from pathlib import Path
from datetime import datetime
from pynput import keyboard
from pynput.keyboard import Key, KeyCode

class ScreenshotCapture:
    def __init__(self):
        self.output_dir = Path(__file__).parent.parent / "data" / "bluebook_screenshots"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.question_num = 1
        self.active = True

        # Track which test/module
        print("\n" + "="*60)
        print("Bluebook Screenshot Capture Tool")
        print("="*60)
        print(f"\nSaving screenshots to: {self.output_dir}")
        print("\nSetup:")
        test_num = input("Practice Test Number (1-6): ").strip()
        module = input("Module (math_m1, math_m2_easy, math_m2_hard, rw_m1, rw_m2_easy, rw_m2_hard): ").strip()

        self.test_num = test_num
        self.module = module

        # Create subfolder
        self.session_dir = self.output_dir / f"test{test_num}_{module}"
        self.session_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n✓ Saving to: {self.session_dir}")
        print("\n" + "="*60)
        print("Controls:")
        print("  Cmd+Shift+C  - Capture screenshot")
        print("  Cmd+Q        - Quit")
        print("="*60)
        print("\nReady! Navigate to first question and press Cmd+Shift+C\n")

    def take_screenshot(self):
        """Capture screenshot using macOS screencapture."""
        filename = f"question_{self.question_num:03d}.png"
        filepath = self.session_dir / filename

        # Use screencapture to capture the screen
        # -x: no sound
        # -T 0: no delay
        subprocess.run([
            'screencapture',
            '-x',
            '-T', '0',
            str(filepath)
        ])

        print(f"✓ Captured: {filename}")
        self.question_num += 1

    def on_activate_capture(self):
        """Called when hotkey is pressed."""
        self.take_screenshot()

    def on_activate_quit(self):
        """Called when quit hotkey is pressed."""
        print("\n" + "="*60)
        print(f"✓ Captured {self.question_num - 1} questions")
        print(f"✓ Saved to: {self.session_dir}")
        print("="*60)
        print("\nNext step:")
        print(f"  python3 scripts/process_screenshots.py {self.session_dir}")
        print()
        self.active = False
        return False  # Stop listener

    def run(self):
        """Start listening for hotkeys."""
        # Cmd+Shift+C for capture
        capture_combo = {keyboard.Key.cmd, keyboard.Key.shift, keyboard.KeyCode.from_char('c')}

        # Cmd+Q for quit
        quit_combo = {keyboard.Key.cmd, keyboard.KeyCode.from_char('q')}

        current_keys = set()

        def on_press(key):
            current_keys.add(key)

            if capture_combo.issubset(current_keys):
                self.on_activate_capture()
            elif quit_combo.issubset(current_keys):
                return self.on_activate_quit()

        def on_release(key):
            try:
                current_keys.remove(key)
            except KeyError:
                pass

        with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
            listener.join()


if __name__ == "__main__":
    try:
        capturer = ScreenshotCapture()
        capturer.run()
    except KeyboardInterrupt:
        print("\n\nExiting...")
