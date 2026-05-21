// Audit script for skill H.D. - Systems of two linear equations in two variables
// Run with: node audit_hd_questions.js

const puppeteer = require('puppeteer');
const fs = require('fs');

async function auditSkillQuestions() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const issues = [];

  try {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.type('input[type="email"]', 'teststudent@example.com');
    await page.type('input[type="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // Navigate to Question Bank
    await page.goto('http://localhost:3000/student/questions');
    await page.waitForTimeout(1000);

    // Expand Heart of Algebra
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const heartButton = buttons.find(b => b.textContent.includes('Heart of Algebra'));
      if (heartButton) heartButton.click();
    });
    await page.waitForTimeout(1500);

    // Click Systems skill
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const systemsButton = buttons.find(b =>
        b.textContent.includes('Systems of two linear equations') &&
        b.textContent.includes('112')
      );
      if (systemsButton) systemsButton.click();
    });

    // Wait for questions to load
    await page.waitForTimeout(3000);

    // Check total questions
    const totalQuestions = await page.evaluate(() => {
      const match = document.body.textContent.match(/(\d+)\s+of\s+(\d+)/);
      return match ? parseInt(match[2]) : 0;
    });

    console.log(`Total questions: ${totalQuestions}`);

    // Audit each question
    for (let i = 0; i < totalQuestions; i++) {
      console.log(`Checking question ${i + 1}/${totalQuestions}...`);

      const questionData = await page.evaluate(() => {
        const issues = [];

        // Check for unrendered LaTeX
        const bodyText = document.body.innerText;
        if (bodyText.includes('\\(') || bodyText.includes('\\)') ||
            bodyText.includes('\\[') || bodyText.includes('\\]')) {
          issues.push('Unrendered LaTeX detected');
        }

        // Check for oversized images
        const images = Array.from(document.querySelectorAll('img'));
        const oversized = images.filter(img => {
          const rect = img.getBoundingClientRect();
          return rect.height > 800 || rect.width > 1000;
        }).length;

        if (oversized > 0) {
          issues.push(`${oversized} oversized image(s)`);
        }

        // Check for missing content
        const mainContent = document.querySelector('main');
        if (!mainContent || mainContent.textContent.trim().length < 20) {
          issues.push('Missing or minimal content');
        }

        // Get question number from header
        const headerText = document.querySelector('header')?.textContent || '';
        const qNumMatch = headerText.match(/(\d+)\s+of\s+(\d+)/);
        const questionNum = qNumMatch ? qNumMatch[1] : 'unknown';

        return {
          questionNum,
          issues,
          hasImages: images.length > 0,
        };
      });

      if (questionData.issues.length > 0) {
        issues.push({
          question: i + 1,
          problems: questionData.issues
        });

        // Take screenshot of problematic question
        await page.screenshot({
          path: `./audit-screenshots/hd-issue-q${i + 1}.png`,
          fullPage: true
        });
      }

      // Navigate to next question (if not last)
      if (i < totalQuestions - 1) {
        await page.click('button:has-text("Next")');
        await page.waitForTimeout(500);
      }
    }

    // Write results
    const report = {
      skill: 'H.D. - Systems of two linear equations in two variables',
      totalQuestions,
      issuesFound: issues.length,
      issues
    };

    fs.writeFileSync('./hd-audit-report.json', JSON.stringify(report, null, 2));
    console.log(`\nAudit complete! Found ${issues.length} questions with issues.`);
    console.log('Report saved to: hd-audit-report.json');

  } catch (error) {
    console.error('Error during audit:', error);
  } finally {
    await browser.close();
  }
}

auditSkillQuestions();
