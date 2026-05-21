const { chromium } = require('playwright');
const fs = require('fs');

async function auditTransitionsSkill() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });
  const page = await context.newPage();

  // Login first
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'teststudent@example.com');
  await page.fill('input[type="password"]', 'testpass123');
  await page.click('button:has-text("Sign in")');
  await page.waitForURL('**/student**', { timeout: 10000 });

  // Fetch all Transitions questions (skill_id=55)
  const response = await page.request.get('http://localhost:8000/api/v1/questions?skill_id=55&limit=161');
  const data = await response.json();
  const questions = data.items;

  console.log(`Total Transitions questions: ${questions.length}`);

  const issues = [];
  let checked = 0;

  for (const question of questions) {
    checked++;

    try {
      // Navigate to question using the question bank with skill filter
      // Since direct navigation doesn't work, we'll use the API data and render check

      // Check for text rendering issues in the HTML
      const html = question.prompt_html || '';

      // Check for missing content
      if (html.trim().length < 20) {
        issues.push({
          questionId: question.id,
          externalId: question.external_id,
          issueType: 'Missing content',
          description: 'Question prompt too short or empty'
        });
      }

      // Check for potential rendering issues with special characters
      if (html.includes('&amp;amp;') || html.includes('&lt;lt;') || html.includes('&gt;gt;')) {
        issues.push({
          questionId: question.id,
          externalId: question.external_id,
          issueType: 'Text rendering',
          description: 'Double-encoded HTML entities detected'
        });
      }

      // Check for broken image tags
      const imgRegex = /<img[^>]*src=["']([^"']*)["'][^>]*>/gi;
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        const src = match[1];

        // Check if image source is empty or invalid
        if (!src || src.trim() === '' || src === '#') {
          issues.push({
            questionId: question.id,
            externalId: question.external_id,
            issueType: 'Missing content',
            description: 'Image tag with empty or invalid src'
          });
        }

        // Check for data URIs that might be too large
        if (src.startsWith('data:image') && src.length > 100000) {
          issues.push({
            questionId: question.id,
            externalId: question.external_id,
            issueType: 'Oversized image',
            description: `Data URI image size: ${(src.length / 1024).toFixed(1)}KB`
          });
        }
      }

      // Check for unclosed tags
      const tagStack = [];
      const tagRegex = /<\/?([a-z][a-z0-9]*)[^>]*>/gi;
      let tagMatch;
      while ((tagMatch = tagRegex.exec(html)) !== null) {
        const fullTag = tagMatch[0];
        const tagName = tagMatch[1].toLowerCase();

        // Skip self-closing tags
        if (fullTag.includes('/>') || ['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName)) {
          continue;
        }

        if (fullTag.startsWith('</')) {
          // Closing tag
          const lastOpen = tagStack.pop();
          if (lastOpen !== tagName) {
            issues.push({
              questionId: question.id,
              externalId: question.external_id,
              issueType: 'Text rendering',
              description: `Mismatched tags: expected </${lastOpen}> but found </${tagName}>`
            });
            break;
          }
        } else {
          // Opening tag
          tagStack.push(tagName);
        }
      }

      if (checked % 20 === 0) {
        console.log(`Checked ${checked}/${questions.length} questions...`);
      }

    } catch (error) {
      issues.push({
        questionId: question.id,
        externalId: question.external_id,
        issueType: 'Error',
        description: `Error checking question: ${error.message}`
      });
    }
  }

  // Save results
  const report = {
    skill: 'TRA - Transitions',
    skillId: 55,
    totalChecked: checked,
    issuesFound: issues.length,
    issues: issues,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    '/Users/ibrahim/Desktop/SAT/SAT_Tool/transitions_audit_report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n=== AUDIT COMPLETE ===');
  console.log(`Skill: TRA - Transitions`);
  console.log(`Total questions checked: ${checked}`);
  console.log(`Issues found: ${issues.length}`);

  if (issues.length > 0) {
    console.log('\nIssues:');
    issues.forEach((issue, idx) => {
      console.log(`${idx + 1}. Question ID: ${issue.externalId || issue.questionId}`);
      console.log(`   Issue: ${issue.issueType} - ${issue.description}\n`);
    });
  } else {
    console.log('\nNo issues found!');
  }

  await browser.close();
  return report;
}

auditTransitionsSkill().catch(console.error);
