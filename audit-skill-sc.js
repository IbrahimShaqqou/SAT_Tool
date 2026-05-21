#!/usr/bin/env node

/**
 * Audit Script for Skill S.C. - Right triangles and trigonometry
 *
 * This script:
 * 1. Logs into the app
 * 2. Navigates to the Question Bank
 * 3. Selects skill S.C. (54 questions)
 * 4. Iterates through all questions
 * 5. Checks for visual defects (broken LaTeX, oversized images, missing content)
 * 6. Generates a report
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = './sc-audit-screenshots';
const REPORT_FILE = './sc-audit-report.json';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function auditSkillSC() {
  console.log('Starting audit of skill S.C. (Right triangles and trigonometry)...\n');

  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  const issues = [];

  try {
    // Step 1: Login
    console.log('Step 1: Logging in...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'teststudent@example.com');
    await page.type('input[type="password"]', 'testpass123');

    // Find and click login button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const loginBtn = buttons.find(b => b.type === 'submit' || b.textContent.includes('Sign in') || b.textContent.includes('Login') || b.textContent.includes('Log in'));
      if (loginBtn) loginBtn.click();
    });

    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
    console.log('✓ Logged in successfully\n');

    // Step 2: Navigate to Question Bank
    console.log('Step 2: Navigating to Question Bank...');
    await page.goto('http://localhost:3000/student/questions', { waitUntil: 'networkidle0' });
    await sleep(2000);
    console.log('✓ On Question Bank page\n');

    // Step 3: Expand Additional Topics in Math and click Right triangles skill
    console.log('Step 3: Selecting skill "Right triangles and trigonometry"...');

    // Expand Additional Topics in Math
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const atButton = buttons.find(b => b.textContent.includes('Additional Topics in Math'));
      if (atButton) atButton.click();
    });

    await sleep(2000);

    // Click "Right triangles and trigonometry" (54 questions)
    const skillFound = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const scButton = buttons.find(b =>
        (b.textContent.includes('Right triangles') || b.textContent.includes('trigonometry')) &&
        (b.textContent.includes('54') || b.textContent.includes('S.C.'))
      );
      if (scButton) {
        scButton.click();
        return true;
      }
      return false;
    });

    if (!skillFound) {
      console.log('⚠ Could not find skill button, trying alternative approach...');
      // Try finding by skill code
      await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        for (let el of allElements) {
          const text = el.textContent || '';
          if (text.includes('Right triangle') && text.length < 200) {
            el.click();
            return;
          }
        }
      });
    }

    console.log('Waiting for questions to load...');
    await sleep(5000); // Wait for questions to load

    // Check if we successfully navigated to practice view
    const inPracticeView = await page.evaluate(() => {
      // Look for question navigation elements
      const hasQuestionNum = document.body.textContent.includes('Question');
      const hasNextButton = Array.from(document.querySelectorAll('button')).some(b =>
        b.textContent.trim() === 'Next'
      );
      return hasQuestionNum && hasNextButton;
    });

    if (!inPracticeView) {
      // Take screenshot for debugging
      await page.screenshot({ path: './debug-sc-navigation-failed.png', fullPage: true });
      throw new Error('Failed to navigate to practice view. Screenshot saved to debug-sc-navigation-failed.png');
    }

    console.log('✓ Skill loaded\n');

    // Step 4: Verify we're in practice mode
    // Wait for practice view to load by checking for question header
    await page.waitForFunction(
      () => {
        const header = document.querySelector('header');
        const headerText = header ? header.textContent : '';
        const bodyText = document.body.textContent;
        return headerText.includes('Right triangles') ||
               headerText.includes('trigonometry') ||
               bodyText.includes('Right triangles') ||
               headerText.includes('Question');
      },
      { timeout: 10000 }
    );

    const headerText = await page.evaluate(() => {
      const header = document.querySelector('header');
      return header ? header.textContent : '';
    });

    console.log(`Header text: ${headerText}\n`);

    // Get total question count
    const totalQuestions = await page.evaluate(() => {
      const match = document.body.textContent.match(/(\d+)\s+of\s+(\d+)/);
      return match ? parseInt(match[2]) : 0;
    });

    console.log(`Total questions to audit: ${totalQuestions}\n`);

    if (totalQuestions === 0) {
      throw new Error('Could not determine question count. Check if skill loaded correctly.');
    }

    if (totalQuestions !== 54) {
      console.warn(`⚠ Warning: Expected 54 questions, found ${totalQuestions}\n`);
    }

    // Step 5: Audit each question
    console.log('Step 4: Auditing questions...\n');

    for (let i = 0; i < totalQuestions; i++) {
      const questionNum = i + 1;
      process.stdout.write(`\rChecking question ${questionNum}/${totalQuestions}...`);

      await sleep(500); // Wait for question to render

      // Audit current question
      const questionData = await page.evaluate(() => {
        const defects = [];

        // Check for unrendered LaTeX
        const bodyText = document.body.innerText;
        if (bodyText.includes('\\(') || bodyText.includes('\\)') ||
            bodyText.includes('\\[') || bodyText.includes('\\]')) {
          defects.push('Unrendered LaTeX');
        }

        // Check for oversized images
        const images = Array.from(document.querySelectorAll('main img'));
        const oversized = images.filter(img => {
          const rect = img.getBoundingClientRect();
          return rect.height > 1000 || rect.width > 1200;
        });

        if (oversized.length > 0) {
          const sizes = oversized.map(img => {
            const rect = img.getBoundingClientRect();
            return `${Math.round(rect.width)}x${Math.round(rect.height)}px`;
          });
          defects.push(`Oversized image(s): ${sizes.join(', ')}`);
        }

        // Check for broken images
        const brokenImages = images.filter(img => !img.complete || img.naturalHeight === 0);
        if (brokenImages.length > 0) {
          defects.push(`${brokenImages.length} broken image(s)`);
        }

        // Check for missing content
        const mainContent = document.querySelector('main');
        const questionText = mainContent?.textContent || '';
        if (questionText.trim().length < 20) {
          defects.push('Missing or minimal content');
        }

        // Check for missing answer choices (MCQ should have 4)
        const answerInput = document.querySelector('input[placeholder*="answer"]');
        const isMCQ = !answerInput;

        if (isMCQ) {
          // Count visible answer choice elements
          const choiceLabels = document.querySelectorAll('[class*="choice"]');
          const choiceButtons = document.querySelectorAll('button[class*="choice"], label');
          const totalChoices = Math.max(choiceLabels.length, choiceButtons.length);

          if (totalChoices > 0 && totalChoices < 4) {
            defects.push(`Only ${totalChoices}/4 answer choices visible`);
          }
        }

        return {
          defects,
          hasImages: images.length > 0,
          isMCQ
        };
      });

      // Record issues if any found
      if (questionData.defects.length > 0) {
        issues.push({
          questionNumber: questionNum,
          issues: questionData.defects
        });

        // Take screenshot of problematic question
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `q${questionNum}-issue.png`),
          fullPage: true
        });
      }

      // Navigate to next question (if not last)
      if (i < totalQuestions - 1) {
        const hasNext = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const nextButton = buttons.find(b => b.textContent.trim() === 'Next' && !b.disabled);
          if (nextButton) {
            nextButton.click();
            return true;
          }
          return false;
        });

        if (!hasNext) {
          console.error(`\n✗ Could not find Next button at question ${questionNum}`);
          break;
        }

        await sleep(300);
      }
    }

    console.log('\n\n✓ Audit complete!\n');

    // Step 6: Generate report
    const report = {
      skill: 'S.C. - Right triangles and trigonometry',
      skillCode: 'S.C.',
      totalQuestionsChecked: totalQuestions,
      questionsWithIssues: issues.length,
      auditDate: new Date().toISOString(),
      issues
    };

    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

    console.log('='.repeat(60));
    console.log('AUDIT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Skill: S.C. - Right triangles and trigonometry`);
    console.log(`Total questions checked: ${totalQuestions}`);
    console.log(`Issues found: ${issues.length}`);
    console.log(`\nReport saved to: ${REPORT_FILE}`);

    if (issues.length > 0) {
      console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/\n`);
      console.log('Issues found:');
      issues.forEach(issue => {
        console.log(`\n  Question ${issue.questionNumber}:`);
        issue.issues.forEach(i => console.log(`    - ${i}`));
      });
    } else {
      console.log('\n✓ No visual defects detected!\n');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n✗ Error during audit:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// Run the audit
auditSkillSC().catch(console.error);
