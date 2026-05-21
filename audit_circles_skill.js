// Audit script for skill S.D. - Circles
// Run with: node audit_circles_skill.js

const puppeteer = require('puppeteer');
const fs = require('fs');

async function auditCirclesSkill() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const issues = [];
  let totalQuestions = 0;

  try {
    console.log('Logging in...');
    // Login
    await page.goto('http://localhost:3000/login');
    await new Promise(r => setTimeout(r, 1000));
    await page.type('input[type="email"]', 'teststudent@example.com');
    await page.type('input[type="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    console.log('Navigating to Question Bank...');
    // Navigate to Question Bank
    await page.goto('http://localhost:3000/student/questions');
    await new Promise(r => setTimeout(r, 2000));

    console.log('Expanding Additional Topics in Math...');
    // Expand Additional Topics in Math
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const additionalTopicsButton = buttons.find(b => b.textContent.includes('Additional Topics in Math'));
      if (additionalTopicsButton) additionalTopicsButton.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    console.log('Clicking on Circles skill...');
    // Click Circles skill
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const circlesButton = buttons.find(b =>
        b.textContent.includes('Circles') ||
        (b.textContent.includes('50') && b.parentElement && b.parentElement.textContent.includes('Circles'))
      );
      if (circlesButton) {
        console.log('Found Circles button:', circlesButton.textContent);
        circlesButton.click();
      } else {
        console.log('Circles button not found');
        console.log('Available buttons:', buttons.map(b => b.textContent.trim()).filter(t => t).slice(0, 20));
      }
    });

    // Wait for questions to load
    await new Promise(r => setTimeout(r, 3000));

    // Check total questions
    totalQuestions = await page.evaluate(() => {
      const match = document.body.textContent.match(/(\d+)\s+of\s+(\d+)/);
      return match ? parseInt(match[2]) : 0;
    });

    console.log(`Total questions found: ${totalQuestions}`);

    if (totalQuestions === 0) {
      console.log('No questions found. Taking screenshot for debugging...');
      await page.screenshot({ path: 'circles-debug.png', fullPage: true });
      console.log('Screenshot saved as circles-debug.png');

      // Try to find any text that might help
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log('Page content preview:', pageText.substring(0, 500));
    }

    // Audit each question
    for (let i = 0; i < totalQuestions; i++) {
      console.log(`Auditing question ${i + 1}/${totalQuestions}...`);

      try {
        const questionData = await page.evaluate(() => {
          const issues = [];

          // Check for unrendered LaTeX
          const bodyText = document.body.innerText;
          if (bodyText.includes('\\(') || bodyText.includes('\\)') ||
              bodyText.includes('\\[') || bodyText.includes('\\]')) {
            issues.push({
              type: 'math rendering error',
              description: 'Unrendered LaTeX detected'
            });
          }

          // Check for oversized images
          const images = Array.from(document.querySelectorAll('img'));
          const oversizedImages = images.filter(img => {
            const rect = img.getBoundingClientRect();
            return rect.height > 800 || rect.width > 1000;
          });

          if (oversizedImages.length > 0) {
            issues.push({
              type: 'oversized image',
              description: `${oversizedImages.length} oversized image(s) detected (>800px height or >1000px width)`
            });
          }

          // Check for missing content
          const mainContent = document.querySelector('main');
          if (!mainContent || mainContent.textContent.trim().length < 20) {
            issues.push({
              type: 'missing content',
              description: 'Missing or minimal main content'
            });
          }

          // Check for missing answer choices in MCQ
          const choicesContainer = document.querySelector('[class*="choice"], [class*="option"], [class*="answer"]');
          const hasChoices = document.querySelectorAll('input[type="radio"]').length > 0 ||
                            document.querySelectorAll('[role="radio"]').length > 0;

          const questionText = document.body.innerText.toLowerCase();
          const isMCQ = questionText.includes('which of the following') ||
                       questionText.includes('what is the') ||
                       questionText.includes('select');

          if (isMCQ && !hasChoices) {
            issues.push({
              type: 'missing content',
              description: 'MCQ question appears to have no answer choices'
            });
          }

          // Get question number from header
          const headerText = document.querySelector('header')?.textContent || document.body.textContent;
          const qNumMatch = headerText.match(/Question\s+(\d+)\s+of\s+(\d+)|(\d+)\s+of\s+(\d+)/i);
          const questionNum = qNumMatch ? (qNumMatch[1] || qNumMatch[3]) : 'unknown';

          return {
            questionNum,
            issues,
            hasImages: images.length > 0,
            imageCount: images.length
          };
        });

        if (questionData.issues.length > 0) {
          issues.push({
            questionNumber: i + 1,
            questionNum: questionData.questionNum,
            issues: questionData.issues,
            hasImages: questionData.hasImages,
            imageCount: questionData.imageCount
          });

          console.log(`  ⚠️  Found ${questionData.issues.length} issue(s):`);
          questionData.issues.forEach(issue => {
            console.log(`      - ${issue.type}: ${issue.description}`);
          });
        }

        // Navigate to next question if not the last
        if (i < totalQuestions - 1) {
          await page.evaluate(() => {
            const nextButton = Array.from(document.querySelectorAll('button')).find(b =>
              b.textContent.includes('Next') ||
              b.textContent.includes('→') ||
              b.getAttribute('aria-label')?.includes('next')
            );
            if (nextButton) nextButton.click();
          });
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (error) {
        console.log(`  Error auditing question ${i + 1}:`, error.message);
        issues.push({
          questionNumber: i + 1,
          error: error.message
        });
      }
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    // Generate report
    const report = {
      skill: 'S.D. - Circles',
      skillId: 48,
      totalQuestionsChecked: totalQuestions,
      issuesFound: issues.length,
      issues: issues,
      timestamp: new Date().toISOString()
    };

    const reportPath = '.playwright-mcp/skill_48_circles_audit_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n${'='.repeat(60)}`);
    console.log('AUDIT COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`Skill: S.D. - Circles`);
    console.log(`Total questions checked: ${totalQuestions}`);
    console.log(`Issues found: ${issues.length}`);
    console.log(`Report saved to: ${reportPath}`);

    if (issues.length > 0) {
      console.log(`\nIssues by type:`);
      const issueTypes = {};
      issues.forEach(q => {
        q.issues?.forEach(issue => {
          issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
        });
      });
      Object.entries(issueTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }

    await browser.close();
  }
}

auditCirclesSkill();
