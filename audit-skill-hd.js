#!/usr/bin/env node

/**
 * Audit Script for Skill H.D. - Systems of two linear equations in two variables
 *
 * This script:
 * 1. Logs into the app
 * 2. Navigates to the Question Bank
 * 3. Selects skill H.D. (112 questions)
 * 4. Iterates through all questions
 * 5. Checks for visual defects (broken LaTeX, oversized images, missing content)
 * 6. Generates a report
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = './hd-audit-screenshots';
const REPORT_FILE = './hd-audit-report.json';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function auditSkillHD() {
  console.log('Starting audit of skill H.D...\n');

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
      const loginBtn = buttons.find(b => b.type === 'submit' || b.textContent.includes('Login') || b.textContent.includes('Log in'));
      if (loginBtn) loginBtn.click();
    });

    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
    console.log('✓ Logged in successfully\n');

    // Step 2: Navigate to Question Bank
    console.log('Step 2: Navigating to Question Bank...');
    await page.goto('http://localhost:3000/student/questions', { waitUntil: 'networkidle0' });
    await sleep(2000);
    console.log('✓ On Question Bank page\n');

    // Step 3: Expand Heart of Algebra and click Systems skill
    console.log('Step 3: Selecting skill "Systems of two linear equations in two variables"...');

    // Expand Heart of Algebra
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const heartButton = buttons.find(b => b.textContent.includes('Heart of Algebra'));
      if (heartButton) heartButton.click();
    });

    await sleep(2000);

    // Click "Systems of two linear equations in two variables" (112 questions)
    const skillFound = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const systemsButton = buttons.find(b =>
        b.textContent.includes('Systems of two linear equations in two variables') &&
        b.textContent.includes('112')
      );
      if (systemsButton) {
        systemsButton.click();
        return true;
      }
      return false;
    });

    if (!skillFound) {
      throw new Error('Could not find skill "Systems of two linear equations in two variables (112)"');
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
      await page.screenshot({ path: './debug-navigation-failed.png', fullPage: true });
      throw new Error('Failed to navigate to practice view. Screenshot saved to debug-navigation-failed.png');
    }

    console.log('✓ Skill loaded\n');

    // Step 4: Verify we're in practice mode
    // Wait for practice view to load by checking for question header
    await page.waitForFunction(
      () => {
        const header = document.querySelector('header');
        const headerText = header ? header.textContent : '';
        return headerText.includes('Systems of two linear equations') ||
               headerText.includes('Question');
      },
      { timeout: 10000 }
    );

    const headerText = await page.evaluate(() => {
      const header = document.querySelector('header');
      return header ? header.textContent : '';
    });

    if (!headerText.includes('Systems of two linear equations') && !headerText.includes('Question')) {
      throw new Error(`Wrong skill loaded. Header shows: ${headerText}`);
    }

    // Get total question count
    const totalQuestions = await page.evaluate(() => {
      const match = document.body.textContent.match(/(\d+)\s+of\s+(\d+)/);
      return match ? parseInt(match[2]) : 0;
    });

    console.log(`Total questions to audit: ${totalQuestions}\n`);

    if (totalQuestions !== 112) {
      console.warn(`⚠ Warning: Expected 112 questions, found ${totalQuestions}\n`);
    }

    // Step 5: Audit each question
    console.log('Step 4: Auditing questions...\n');

    for (let i = 0; i < totalQuestions; i++) {
      const questionNum = i + 1;
      process.stdout.write(`\rChecking question ${questionNum}/${totalQuestions}...`);

      await sleep(400); // Wait for question to render

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
      skill: 'H.D. - Systems of two linear equations in two variables',
      skillCode: 'H.D.',
      totalQuestionsChecked: totalQuestions,
      questionsWithIssues: issues.length,
      auditDate: new Date().toISOString(),
      issues
    };

    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

    console.log('='.repeat(60));
    console.log('AUDIT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Skill: H.D. - Systems of two linear equations in two variables`);
    console.log(`Total questions checked: ${totalQuestions}`);
    console.log(`Questions with issues: ${issues.length}`);
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
auditSkillHD().catch(console.error);
