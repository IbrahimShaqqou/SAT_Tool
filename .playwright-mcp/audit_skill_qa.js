const { chromium } = require('playwright');
const fs = require('fs');

// Read questions from API data
const questionsData = JSON.parse(fs.readFileSync('/tmp/skill_38_all_questions.json', 'utf8'));
const questions = questionsData.items;

console.log(`Total questions to audit: ${questions.length}`);

const issues = [];
let questionsChecked = 0;

async function auditSkillQA() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 1024 }
  });

  const page = await context.newPage();

  // Login first
  console.log('Logging in...');
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'teststudent@example.com');
  await page.fill('input[type="password"]', 'testpass123');
  await page.click('button:has-text("Sign in")');
  await page.waitForURL('**/student**', { timeout: 10000 });
  console.log('Logged in successfully');

  // Create a practice session for skill 38
  console.log('Starting practice session for skill Q.A. (ID 38)...');
  await page.goto('http://localhost:3000/student/adaptive?skill=38&autostart=true');
  await page.waitForTimeout(3000);

  // Check if we're in a practice session
  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);

  // If we successfully started, iterate through questions
  if (currentUrl.includes('/practice/') || currentUrl.includes('/questions')) {
    console.log('Practice session started, beginning audit...');

    for (let i = 0; i < Math.min(questions.length, 84); i++) {
      const question = questions[i];
      questionsChecked++;

      console.log(`\n[${questionsChecked}/${questions.length}] Checking question ${question.external_id || question.id}`);

      try {
        // Wait for question to load
        await page.waitForTimeout(2000);

        // Take screenshot
        const screenshotPath = `/Users/ibrahim/Desktop/SAT/SAT_Tool/.playwright-mcp/skill_qa_q${questionsChecked}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });

        // Check for math rendering errors
        const mathErrors = await page.$$('math:has-text("�")');
        if (mathErrors.length > 0) {
          issues.push({
            questionId: question.external_id || question.id,
            questionNumber: questionsChecked,
            type: 'Math Rendering Error',
            description: `Found ${mathErrors.length} math rendering error(s) with replacement characters`,
            screenshot: screenshotPath
          });
          console.log(`  ⚠️  Math rendering error detected`);
        }

        // Check for oversized images
        const images = await page.$$('img');
        for (const img of images) {
          const box = await img.boundingBox();
          if (box && (box.width > 800 || box.height > 600)) {
            issues.push({
              questionId: question.external_id || question.id,
              questionNumber: questionsChecked,
              type: 'Oversized Image',
              description: `Image dimensions: ${Math.round(box.width)}x${Math.round(box.height)}px (exceeds 800x600)`,
              screenshot: screenshotPath
            });
            console.log(`  ⚠️  Oversized image: ${Math.round(box.width)}x${Math.round(box.height)}px`);
          }
        }

        // Check for missing content (empty question body)
        const questionBody = await page.$('[class*="question"]');
        if (!questionBody) {
          issues.push({
            questionId: question.external_id || question.id,
            questionNumber: questionsChecked,
            type: 'Missing Content',
            description: 'Question body container not found',
            screenshot: screenshotPath
          });
          console.log(`  ⚠️  Missing content - no question body found`);
        } else {
          const text = await questionBody.textContent();
          if (!text || text.trim().length < 10) {
            issues.push({
              questionId: question.external_id || question.id,
              questionNumber: questionsChecked,
              type: 'Missing Content',
              description: 'Question body appears empty or too short',
              screenshot: screenshotPath
            });
            console.log(`  ⚠️  Missing content - question body too short`);
          }
        }

        // Click next button if available (and not last question)
        if (i < questions.length - 1) {
          const nextButton = await page.$('button:has-text("Next")');
          if (nextButton) {
            await nextButton.click();
            await page.waitForTimeout(1500);
          } else {
            console.log(`  ℹ️  No "Next" button found, attempting to continue...`);
            // Try alternative navigation
            break;
          }
        }

      } catch (error) {
        console.error(`  ❌ Error checking question: ${error.message}`);
        issues.push({
          questionId: question.external_id || question.id,
          questionNumber: questionsChecked,
          type: 'Audit Error',
          description: `Failed to audit: ${error.message}`,
          screenshot: null
        });
      }
    }
  } else {
    console.log('❌ Failed to start practice session');
  }

  await browser.close();

  // Generate report
  const report = {
    skill: 'Q.A. - Ratios, rates, proportional relationships, and units',
    skillId: 38,
    totalQuestions: questions.length,
    questionsChecked: questionsChecked,
    issuesFound: issues.length,
    issues: issues,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    '/Users/ibrahim/Desktop/SAT/SAT_Tool/.playwright-mcp/skill_qa_audit_report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n' + '='.repeat(60));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Skill: Q.A. - Ratios, rates, proportional relationships, and units`);
  console.log(`Total questions checked: ${questionsChecked}`);
  console.log(`Issues found: ${issues.length}`);

  if (issues.length > 0) {
    console.log('\nIssues:');
    issues.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. Question ${issue.questionNumber} (ID: ${issue.questionId})`);
      console.log(`   Type: ${issue.type}`);
      console.log(`   Description: ${issue.description}`);
    });
  }

  console.log('\nFull report saved to: skill_qa_audit_report.json');
}

auditSkillQA().catch(console.error);
