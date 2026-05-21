// Direct audit of Circles skill questions by question ID
// This script reads question IDs from file and audits them directly

const puppeteer = require('puppeteer');
const fs = require('fs');

// Circle question IDs (S.D. skill) from the data files
const circleQuestionIds = fs.readFileSync('/tmp/circles_question_ids.txt', 'utf8')
  .trim()
  .split('\n');

async function auditCirclesQuestions() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const issues = [];
  let successCount = 0;

  try {
    console.log(`Found ${circleQuestionIds.length} Circle questions to audit\n`);
    console.log('Logging in...');

    // Login
    await page.goto('http://localhost:3000/login');
    await new Promise(r => setTimeout(r, 1000));

    // Check if already logged in
    const isLoggedIn = await page.evaluate(() => {
      return !window.location.href.includes('/login');
    });

    if (!isLoggedIn) {
      await page.type('input[type="email"]', 'teststudent@example.com');
      await page.type('input[type="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    }

    console.log('Starting audit...\n');

    // Audit each question
    for (let i = 0; i < circleQuestionIds.length; i++) {
      const questionId = circleQuestionIds[i];
      console.log(`[${i + 1}/${circleQuestionIds.length}] Auditing question ${questionId}...`);

      try {
        // Try navigating to question bank with skill filter
        await page.goto(`http://localhost:3000/student/questions?skill=48&q=${i}`, {
          waitUntil: 'networkidle2',
          timeout: 10000
        });
        await new Promise(r => setTimeout(r, 2000));

        const questionData = await page.evaluate((qId) => {
          const issues = [];

          // Check for unrendered LaTeX
          const bodyText = document.body.innerText;
          if (bodyText.includes('\\(') || bodyText.includes('\\)') ||
              bodyText.includes('\\[') || bodyText.includes('\\]')) {
            issues.push({
              type: 'math rendering error',
              description: 'Unrendered LaTeX detected in page content'
            });
          }

          // Check for oversized images
          const images = Array.from(document.querySelectorAll('img'));
          const oversizedImages = images.filter(img => {
            const rect = img.getBoundingClientRect();
            return rect.height > 800 || rect.width > 1000;
          });

          if (oversizedImages.length > 0) {
            const details = oversizedImages.map(img => {
              const rect = img.getBoundingClientRect();
              return `${Math.round(rect.width)}x${Math.round(rect.height)}px`;
            }).join(', ');
            issues.push({
              type: 'oversized image',
              description: `${oversizedImages.length} oversized image(s): ${details}`
            });
          }

          // Check for missing main content
          const mainContent = document.querySelector('main, [role="main"], .question-content');
          const hasMinimalContent = !mainContent || mainContent.textContent.trim().length < 20;

          if (hasMinimalContent) {
            issues.push({
              type: 'missing content',
              description: 'Missing or insufficient main content area'
            });
          }

          // Check for missing answer choices in what appears to be MCQ
          const hasRadioButtons = document.querySelectorAll('input[type="radio"], [role="radio"]').length > 0;
          const hasChoiceButtons = document.querySelectorAll('button[class*="choice"], button[class*="option"]').length >= 2;
          const questionText = bodyText.toLowerCase();
          const appearsToBeMCQ = questionText.includes('which of the following') ||
                                 questionText.includes('which choice') ||
                                 (questionText.includes('?') && bodyText.length > 50);

          if (appearsToBeMCQ && !hasRadioButtons && !hasChoiceButtons) {
            issues.push({
              type: 'missing content',
              description: 'Appears to be MCQ but no answer choices found'
            });
          }

          return {
            questionId: qId,
            issues,
            pageTitle: document.title,
            hasContent: !hasMinimalContent,
            imageCount: images.length,
            url: window.location.href
          };
        }, questionId);

        if (questionData.issues.length > 0) {
          issues.push({
            questionId: questionId,
            questionNumber: i + 1,
            ...questionData,
            screenshot: `circles-issue-${i + 1}.png`
          });

          console.log(`  ⚠️  Found ${questionData.issues.length} issue(s):`);
          questionData.issues.forEach(issue => {
            console.log(`      - ${issue.type}: ${issue.description}`);
          });

          // Take screenshot of problematic questions
          await page.screenshot({
            path: `.playwright-mcp/circles-issue-${i + 1}.png`,
            fullPage: false
          });
        } else {
          successCount++;
          console.log(`  ✓ No issues`);
        }

      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
        issues.push({
          questionId: questionId,
          questionNumber: i + 1,
          error: error.message
        });
      }

      // Small delay between questions
      await new Promise(r => setTimeout(r, 500));
    }

  } catch (error) {
    console.error('\nFatal error:', error);
  } finally {
    // Generate report
    const report = {
      skill: 'S.D. - Circles',
      skillId: 48,
      skillCode: 'S.D.',
      totalQuestionsChecked: circleQuestionIds.length,
      questionsWithIssues: issues.length,
      questionsWithoutIssues: successCount,
      issues: issues,
      timestamp: new Date().toISOString()
    };

    const reportPath = '.playwright-mcp/skill_48_circles_direct_audit.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n${'='.repeat(70)}`);
    console.log('AUDIT COMPLETE - Circles Skill (S.D.)');
    console.log(`${'='.repeat(70)}`);
    console.log(`Total questions checked: ${circleQuestionIds.length}`);
    console.log(`Questions with issues: ${issues.length}`);
    console.log(`Questions without issues: ${successCount}`);
    console.log(`Report saved to: ${reportPath}`);

    if (issues.length > 0) {
      console.log(`\nIssue Summary:`);
      const issueTypes = {};
      issues.forEach(q => {
        if (q.issues) {
          q.issues.forEach(issue => {
            issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
          });
        }
      });
      Object.entries(issueTypes).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} occurrence(s)`);
      });

      console.log(`\nQuestions with issues:`);
      issues.slice(0, 10).forEach(q => {
        console.log(`  - Question ${q.questionNumber} (ID: ${q.questionId})`);
      });
      if (issues.length > 10) {
        console.log(`  ... and ${issues.length - 10} more`);
      }
    }

    console.log(`\n${'='.repeat(70)}`);

    await browser.close();
  }
}

auditCirclesQuestions().catch(console.error);
