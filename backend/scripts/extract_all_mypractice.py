#!/usr/bin/env python3
"""
Extract all 98 questions from MyPractice SAT results page using Playwright.

Usage:
    python3 extract_all_mypractice.py

Prerequisites:
- You must be logged into MyPractice and on the test details page
- Playwright must be installed: pip3 install playwright && playwright install
"""

import asyncio
import json
import re
from playwright.async_api import async_playwright
from pathlib import Path


async def extract_all_questions():
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        # Navigate (user should already be logged in)
        print("Navigate to the MyPractice test details page and press Enter...")
        input()

        current_url = page.url
        print(f"Current URL: {current_url}")

        # Scroll to table
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
        await asyncio.sleep(1)

        # Get all rows
        rows = await page.query_selector_all('table tbody tr')
        total = len(rows)

        print(f"\nFound {total} questions to extract\n")

        results = []

        for i in range(total):
            print(f"Extracting question {i + 1}/{total}...")

            # Re-query rows (page might have rerendered)
            rows = await page.query_selector_all('table tbody tr')
            row = rows[i]

            # Click review button
            review_btn = await row.query_selector('button')
            if not review_btn:
                print(f"  ⚠ No review button found")
                continue

            await review_btn.click()
            await asyncio.sleep(1.2)  # Wait for modal

            # Extract question content
            modal = await page.query_selector('.test-questions-modal.cb-open')
            if not modal:
                print(f"  ⚠ Modal didn't open")
                continue

            # Get all text
            text_content = await modal.inner_text()

            # Get HTML for parsing
            html_content = await modal.inner_html()

            # Parse question
            question_data = parse_question(text_content, html_content)
            question_data['questionNumber'] = i + 1

            results.append(question_data)

            print(f"  ✓ Extracted: {question_data['prompt'][:60]}...")

            # Close modal
            close_btn = await modal.query_selector('button[data-cb-modal-close]')
            if close_btn:
                await close_btn.click()
                await asyncio.sleep(0.5)

        # Save results
        output_file = Path(__file__).parent.parent / "data" / "mypractice_test4_extracted.json"
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)

        print(f"\n✓ Extracted {len(results)} questions")
        print(f"✓ Saved to: {output_file}")

        await browser.close()

        return results


def parse_question(text, html):
    """Parse question content from modal text and HTML."""
    lines = text.split('\n')

    # Extract question number/section
    section = lines[0] if lines else ''

    # Find stimulus and prompt
    # Usually separated by multiple lines
    stimulus = ''
    prompt = ''
    choices = []

    # Simple parsing - get everything before "Which choice" as stimulus
    if 'Which choice' in text:
        parts = text.split('Which choice')
        stimulus = parts[0].strip()
        prompt = 'Which choice' + parts[1].split('\n')[0]

        # Extract choices (usually labeled A, B, C, D)
        choice_section = parts[1]
        choice_matches = re.findall(r'^([A-D])\s+(.+)$', choice_section, re.MULTILINE)
        choices = [match[1] for match in choice_matches]

    return {
        'section': section,
        'stimulus': stimulus,
        'prompt': prompt,
        'choices': choices,
        'fullText': text
    }


if __name__ == "__main__":
    asyncio.run(extract_all_questions())
