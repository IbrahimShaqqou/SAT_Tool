const { chromium } = require('playwright');
const { Client } = require('pg');

// Database configuration
const dbConfig = {
  host: 'localhost',
  port: 5433,
  user: 'sat_user',
  password: 'sat_password',
  database: 'sat_tutor'
};

// Issue tracking
const issues = [];
let questionsChecked = 0;

async function auditQuestion(page, questionId, questionNumber, totalQuestions) {
  try {
    console.log(`\nChecking question ${questionNumber}/${totalQuestions}: ${questionId}`);

    // Navigate to the question via practice mode (simulating clicking through UI)
    await page.goto(`http://localhost:3000/student/questions?questionId=${questionId}`, {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    await page.waitForTimeout(1000);

    // Take snapshot and screenshot
    const snapshot = await page.accessibility.snapshot();
    const screenshotPath = `/tmp/cid_audit/question_${questionNumber}_${questionId.slice(0,8)}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Check for common issues
    const questionIssues = await page.evaluate(() => {
      const issues = [];

      // Check 1: Missing or broken images
      const images = Array.from(document.querySelectorAll('img'));
      images.forEach((img, idx) => {
        if (!img.complete || img.naturalWidth === 0) {
          issues.push({
            type: 'Broken Image',
            detail: `Image ${idx + 1} failed to load or is broken`
          });
        }
        // Check for oversized images
        if (img.naturalWidth > 0 && (img.width > 1000 || img.height > 800)) {
          issues.push({
            type: 'Oversized Image',
            detail: `Image ${idx + 1} is very large (${img.width}x${img.height}px)`
          });
        }
      });

      // Check 2: Text rendering issues (empty or truncated content)
      const questionText = document.querySelector('[class*="question"]') || document.querySelector('main');
      if (questionText) {
        const text = questionText.textContent.trim();
        if (text.length < 10) {
          issues.push({
            type: 'Missing Content',
            detail: 'Question text appears to be missing or too short'
          });
        }
      }

      // Check 3: Look for error messages or warnings
      const errorElements = Array.from(document.querySelectorAll('[class*="error"], [class*="warning"]'));
      errorElements.forEach((el, idx) => {
        if (el.offsetParent !== null) { // Check if visible
          issues.push({
            type: 'Error/Warning Visible',
            detail: `Error/warning element ${idx + 1}: ${el.textContent.slice(0, 100)}`
          });
        }
      });

      // Check 4: Missing answer choices (for multiple choice)
      const choices = document.querySelectorAll('[class*="choice"], [type="radio"]');
      if (choices.length > 0 && choices.length < 2) {
        issues.push({
          type: 'Incomplete Answer Choices',
          detail: `Only ${choices.length} answer choice(s) found`
        });
      }

      return issues;
    });

    if (questionIssues.length > 0) {
      questionIssues.forEach(issue => {
        issues.push({
          questionId,
          questionNumber,
          ...issue,
          screenshot: screenshotPath
        });
      });
      console.log(`  ⚠️  Found ${questionIssues.length} issue(s)`);
    } else {
      console.log(`  ✓ No issues found`);
    }

    questionsChecked++;

  } catch (error) {
    console.error(`  ❌ Error checking question: ${error.message}`);
    issues.push({
      questionId,
      questionNumber,
      type: 'Audit Error',
      detail: `Failed to audit: ${error.message}`
    });
  }
}

async function main() {
  // Create output directory
  const fs = require('fs');
  if (!fs.existsSync('/tmp/cid_audit')) {
    fs.mkdirSync('/tmp/cid_audit');
  }

  // Connect to database
  console.log('Connecting to database...');
  const client = new Client(dbConfig);
  await client.connect();

  // Get all CID questions
  console.log('Fetching CID questions from database...');
  const result = await client.query(
    "SELECT id FROM questions WHERE skill_id = 49 ORDER BY id"
  );
  const questionIds = result.rows.map(row => row.id);
  console.log(`Found ${questionIds.length} questions for CID skill\n`);

  // Launch browser
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 }
  });
  const page = await context.newPage();

  // Login first
  console.log('Logging in...');
  await page.goto('http://localhost:3000/login');
  await page.fill('[type="email"]', 'teststudent@example.com');
  await page.fill('[type="password"]', 'testpass123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/student**', { timeout: 10000 });
  console.log('Logged in successfully\n');

  // Audit each question
  const totalQuestions = questionIds.length;
  for (let i = 0; i < totalQuestions; i++) {
    await auditQuestion(page, questionIds[i], i + 1, totalQuestions);

    // Add small delay between questions
    await page.waitForTimeout(500);
  }

  // Close browser
  await browser.close();
  await client.end();

  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nSkill: CID - Central Ideas and Details`);
  console.log(`Total questions checked: ${questionsChecked}`);
  console.log(`Issues found: ${issues.length}\n`);

  if (issues.length > 0) {
    console.log('ISSUES FOUND:\n');
    issues.forEach((issue, idx) => {
      console.log(`${idx + 1}. Question ${issue.questionNumber} (ID: ${issue.questionId.slice(0, 8)}...)`);
      console.log(`   Type: ${issue.type}`);
      console.log(`   Description: ${issue.detail}`);
      if (issue.screenshot) {
        console.log(`   Screenshot: ${issue.screenshot}`);
      }
      console.log('');
    });
  } else {
    console.log('✓ No issues found - all questions look good!');
  }

  // Save report to file
  const reportPath = '/tmp/cid_audit/audit_report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    skill: 'CID - Central Ideas and Details',
    totalQuestionsChecked: questionsChecked,
    issuesFound: issues.length,
    issues: issues
  }, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);
}

main().catch(console.error);
