#!/usr/bin/env python3
"""
mitmproxy addon to intercept and save Bluebook API responses.

Usage:
    mitmdump -s bluebook_interceptor.py --ssl-insecure

This will:
1. Intercept all HTTPS traffic from Bluebook
2. Save question data from API responses
3. Build practice test mappings automatically
"""

import json
import re
from pathlib import Path
from datetime import datetime
from mitmproxy import http


class BluebookInterceptor:
    def __init__(self):
        self.output_dir = Path(__file__).parent.parent / "data" / "bluebook_captures"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.question_count = 0
        self.captured_questions = []

        print(f"\n{'='*60}")
        print("Bluebook Traffic Interceptor")
        print(f"{'='*60}")
        print(f"Saving captures to: {self.output_dir}")
        print("Waiting for Bluebook traffic...\n")

    def response(self, flow: http.HTTPFlow) -> None:
        """Called for every HTTP response."""

        # Only process collegeboard.org traffic
        if "collegeboard" not in flow.request.pretty_host.lower():
            return

        # Log the request
        url = flow.request.pretty_url
        method = flow.request.method

        # Check if this looks like a question API
        if any(keyword in url.lower() for keyword in ['question', 'test', 'assessment', 'practice']):
            print(f"[{method}] {url}")

            # Try to parse response as JSON
            try:
                content_type = flow.response.headers.get("content-type", "")

                if "json" in content_type.lower():
                    response_data = json.loads(flow.response.content)

                    # Save raw response
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"response_{timestamp}_{self.question_count}.json"
                    filepath = self.output_dir / filename

                    with open(filepath, 'w') as f:
                        json.dump({
                            'url': url,
                            'method': method,
                            'timestamp': timestamp,
                            'response': response_data
                        }, f, indent=2)

                    print(f"  ✓ Saved: {filename}")

                    # Try to extract questions
                    questions = self.extract_questions(response_data)
                    if questions:
                        print(f"  ✓ Found {len(questions)} question(s)")
                        self.captured_questions.extend(questions)
                        self.question_count += len(questions)

            except json.JSONDecodeError:
                # Not JSON, might be binary or other format
                pass
            except Exception as e:
                print(f"  ⚠ Error processing response: {e}")

    def extract_questions(self, data):
        """Extract question objects from API response."""
        questions = []

        # Recursive search for question-like objects
        def search_dict(obj, depth=0):
            if depth > 10:  # Prevent infinite recursion
                return

            if isinstance(obj, dict):
                # Check if this looks like a question
                if self.is_question_object(obj):
                    questions.append(obj)

                # Recurse into nested objects
                for value in obj.values():
                    if isinstance(value, (dict, list)):
                        search_dict(value, depth + 1)

            elif isinstance(obj, list):
                for item in obj:
                    if isinstance(item, (dict, list)):
                        search_dict(item, depth + 1)

        search_dict(data)
        return questions

    def is_question_object(self, obj):
        """Check if object looks like a question."""
        if not isinstance(obj, dict):
            return False

        # Common question fields
        question_fields = [
            'questionId', 'question_id', 'qId', 'uId',
            'prompt', 'stimulus', 'stem',
            'choices', 'options', 'answerOptions',
            'correct', 'correctAnswer', 'answer'
        ]

        # Must have at least 2 question-related fields
        matches = sum(1 for field in question_fields if field in obj)
        return matches >= 2

    def done(self):
        """Called when mitmproxy shuts down."""
        if self.captured_questions:
            # Save all captured questions to master file
            master_file = self.output_dir / "all_questions.json"
            with open(master_file, 'w') as f:
                json.dump(self.captured_questions, f, indent=2)

            print(f"\n{'='*60}")
            print(f"✓ Captured {len(self.captured_questions)} total questions")
            print(f"✓ Saved to: {master_file}")
            print(f"{'='*60}\n")


addons = [BluebookInterceptor()]
