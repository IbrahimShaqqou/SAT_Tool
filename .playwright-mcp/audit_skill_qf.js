const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SKILL_ID = 39;
const SKILL_CODE = 'Q.F.';
const SKILL_NAME = 'Inference from sample statistics and margin of error';
const OUTPUT_DIR = path.join(__dirname, 'skill_39_audit');
const REPORT_FILE = path.join(OUTPUT_DIR, 'audit_report.json');

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const issues = [];
let questionsChecked = 0;

async function fetchAllQuestions(page) {
  console.log(`Fetching all questions for skill ${SKILL_ID} (${SKILL_CODE})...`);

  const questions = await page.evaluate(async (skillId) => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`http://localhost:8000/api/v1/questions?skill_id=${skillId}&limit=200`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.items || [];
  }, SKILL_ID);

  console.log(`✓ Fetched ${questions.length} questions\n`);
  return questions;
}

async function auditQuestion(page, question, questionNumber) {
  const questionIssues = [];

  try {
    // Render the question HTML in a temporary container
    await page.evaluate((html) => {
      const container = document.getElementById('audit-container');
      if (container) {
        container.innerHTML = html;
      } else {
        const newContainer = document.createElement('div');
        newContainer.id = 'audit-container';
        newContainer.innerHTML = html;
        newContainer.style.padding = '20px';
        newContainer.style.maxWidth = '800px';
        newContainer.style.margin = '0 auto';
        document.body.appendChild(newContainer);
      }
    }, question.prompt_html);

    await page.waitForTimeout(500); // Wait for rendering

    // Check for math rendering errors
    const mathErrors = await page.evaluate(() => {
      const container = document.getElementById('audit-container');
      if (!container) return [];

      const errors = [];

      // Check for unrendered MathML or LaTeX
      const mathElements = container.querySelectorAll('math');
      mathElements.forEach((math, idx) => {
        const text = math.textContent;
        if (text.includes('�') || text.includes('\\(') || text.includes('\\)')) {
          errors.push(`Math element ${idx + 1} contains rendering errors`);
        }
      });

      // Check for raw LaTeX in text
      const bodyText = container.textContent;
      if (bodyText.includes('\\frac') || bodyText.includes('\\sqrt') ||
          bodyText.includes('alttext=')) {
        errors.push('Unrendered LaTeX found in question text');
      }

      return errors;
    });

    if (mathErrors.length > 0) {
      questionIssues.push(...mathErrors.map(err => ({
        type: 'Math Rendering Error',
        description: err
      })));
    }

    // Check for oversized images
    const imageIssues = await page.evaluate(() => {
      const container = document.getElementById('audit-container');
      if (!container) return [];

      const images = Array.from(container.querySelectorAll('img'));
      const oversized = [];

      images.forEach((img, idx) => {
        const rect = img.getBoundingClientRect();
        if (rect.width > 800 || rect.height > 600) {
          oversized.push({
            index: idx + 1,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }
      });

      return oversized;
    });

    if (imageIssues.length > 0) {
      imageIssues.forEach(img => {
        questionIssues.push({
          type: 'Oversized Image',
          description: `Image ${img.index}: ${img.width}x${img.height}px (exceeds 800x600)`
        });
      });
    }

    // Check for missing content
    const contentCheck = await page.evaluate(() => {
      const container = document.getElementById('audit-container');
      if (!container) return { hasContent: false, textLength: 0 };

      const text = container.textContent.trim();
      return {
        hasContent: text.length > 20,
        textLength: text.length
      };
    });

    if (!contentCheck.hasContent) {
      questionIssues.push({
        type: 'Missing Content',
        description: `Question content is too short (${contentCheck.textLength} characters)`
      });
    }

    // Take screenshot if there are issues
    if (questionIssues.length > 0) {
      const screenshotPath = path.join(OUTPUT_DIR, `q${questionNumber}_${question.id.substring(0, 8)}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false
      });

      return {
        questionId: question.id,
        external_id: question.external_id,
        questionNumber,
        issues: questionIssues,
        screenshot: path.basename(screenshotPath)
      };
    }

    return null;

  } catch (error) {
    return {
      questionId: question.id,
      external_id: question.external_id,
      questionNumber,
      issues: [{
        type: 'Audit Error',
        description: `Failed to audit: ${error.message}`
      }],
      screenshot: null
    };
  }
}

async function auditSkillQF() {
  console.log('='.repeat(60));
  console.log(`Auditing Skill ${SKILL_CODE} - ${SKILL_NAME}`);
  console.log('='.repeat(60));
  console.log();

  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });

  const page = await context.newPage();

  try {
    // Login
    console.log('Logging in...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'teststudent@example.com');
    await page.fill('input[type="password"]', 'testpass123');

    const loginButton = await page.$('button[type="submit"]');
    if (loginButton) {
      await loginButton.click();
      await page.waitForURL('**/student**', { timeout: 10000 });
      console.log('✓ Logged in successfully\n');
    } else {
      throw new Error('Login button not found');
    }

    // Fetch all questions
    const questions = await fetchAllQuestions(page);

    if (questions.length === 0) {
      console.log('❌ No questions found for this skill');
      await browser.close();
      return;
    }

    // Audit each question
    console.log('Starting audit...\n');

    for (let i = 0; i < questions.length; i++) {
      questionsChecked++;
      const question = questions[i];

      process.stdout.write(`\r[${questionsChecked}/${questions.length}] Checking question ${questionsChecked}...`);

      const result = await auditQuestion(page, question, questionsChecked);

      if (result) {
        issues.push(result);
        process.stdout.write(` ⚠️  ${result.issues.length} issue(s) found`);
      }

      process.stdout.write('\n');
    }

    console.log('\n✓ Audit complete!\n');

  } catch (error) {
    console.error('\n❌ Error during audit:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }

  // Generate report
  const report = {
    skill: `${SKILL_CODE} - ${SKILL_NAME}`,
    skillId: SKILL_ID,
    skillCode: SKILL_CODE,
    totalQuestions: questionsChecked,
    questionsWithIssues: issues.length,
    issues: issues,
    auditDate: new Date().toISOString()
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  // Print summary
  console.log('='.repeat(60));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Skill: ${SKILL_CODE} - ${SKILL_NAME}`);
  console.log(`Total questions checked: ${questionsChecked}`);
  console.log(`Issues found: ${issues.length}`);
  console.log();

  if (issues.length > 0) {
    console.log('Issues by type:');
    const issueTypes = {};
    issues.forEach(item => {
      item.issues.forEach(issue => {
        issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
      });
    });

    Object.entries(issueTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log();
    console.log('Detailed issues:');
    issues.forEach((item, idx) => {
      console.log(`\n${idx + 1}. Question ${item.questionNumber} (ID: ${item.questionId.substring(0, 8)}...)`);
      item.issues.forEach(issue => {
        console.log(`   - [${issue.type}] ${issue.description}`);
      });
      if (item.screenshot) {
        console.log(`   Screenshot: ${item.screenshot}`);
      }
    });
  } else {
    console.log('✓ No issues detected!');
  }

  console.log();
  console.log(`Full report saved to: ${REPORT_FILE}`);
  console.log(`Screenshots saved to: ${OUTPUT_DIR}/`);
  console.log('='.repeat(60));
}

// Run the audit
auditSkillQF().catch(console.error);
