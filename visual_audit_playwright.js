/**
 * Visual audit script using Playwright
 * Audits all questions for Skill Q.E. (Probability and conditional probability)
 */

const fs = require('fs');
const path = require('path');

const SKILL_ID = 41;
const SKILL_CODE = 'Q.E.';
const SKILL_NAME = 'Probability and conditional probability';
const API_URL = 'http://localhost:8000/api/v1';
const OUTPUT_DIR = './.playwright-mcp/skill_41_audit';

// Read questions from the saved data
const questionsData = JSON.parse(
  fs.readFileSync(path.join(OUTPUT_DIR, 'questions_data.json'), 'utf8')
);

console.log(`\n========================================`);
console.log(`Visual Audit for Skill ${SKILL_CODE}`);
console.log(`${SKILL_NAME}`);
console.log(`========================================\n`);
console.log(`Total questions to audit: ${questionsData.length}\n`);

const report = {
  skill: { id: SKILL_ID, code: SKILL_CODE, name: SKILL_NAME },
  totalQuestions: questionsData.length,
  issuesFound: 0,
  issues: [],
  timestamp: new Date().toISOString()
};

// Analyze each question for visual issues
questionsData.forEach((question, index) => {
  const qNum = index + 1;
  const issues = [];

  console.log(`${qNum}. Question ID: ${question.id.substring(0, 8)}...`);

  // Check for math rendering
  if (question.prompt_html) {
    // Check for broken/missing math tags
    const mathTags = question.prompt_html.match(/<math[^>]*>[\s\S]*?<\/math>/g) || [];
    const inlineMath = question.prompt_html.match(/\\\([^)]*\\\)/g) || [];
    const displayMath = question.prompt_html.match(/\\\[[^\]]*\\\]/g) || [];

    if (mathTags.length > 0) {
      console.log(`   - Contains ${mathTags.length} <math> tag(s)`);

      // Check for potentially broken math
      mathTags.forEach((tag, i) => {
        if (tag.includes('alttext=""') || tag.trim().endsWith('<math>')) {
          issues.push({
            type: 'Math Rendering Error',
            description: `Math tag ${i + 1} may be empty or malformed`
          });
        }
      });
    }

    if (inlineMath.length > 0) {
      console.log(`   - Contains ${inlineMath.length} inline math expression(s)`);
    }

    if (displayMath.length > 0) {
      console.log(`   - Contains ${displayMath.length} display math expression(s)`);
    }

    // Check for images
    const imgTags = question.prompt_html.match(/<img[^>]*>/g) || [];
    const base64Images = question.prompt_html.match(/data:image\/[^;]+;base64,([^"']+)/g) || [];

    if (imgTags.length > 0) {
      console.log(`   - Contains ${imgTags.length} image(s)`);

      imgTags.forEach((img, i) => {
        // Check if img has alt text
        if (!img.includes('alt=') || img.includes('alt=""')) {
          console.log(`     ⚠️  Image ${i + 1} missing descriptive alt text`);
        }

        // Check if image is a base64 data URI
        if (img.includes('data:image')) {
          const match = img.match(/data:image\/[^;]+;base64,([^"']+)/);
          if (match && match[1]) {
            const sizeKB = Math.round((match[1].length * 0.75) / 1024);
            console.log(`     - Image ${i + 1} size: ~${sizeKB}KB (embedded base64)`);

            if (sizeKB > 200) {
              issues.push({
                type: 'Oversized Image',
                description: `Image ${i + 1} is ${sizeKB}KB (very large embedded image)`
              });
            } else if (sizeKB > 100) {
              issues.push({
                type: 'Oversized Image',
                description: `Image ${i + 1} is ${sizeKB}KB (large embedded image)`
              });
            }
          }
        }
      });
    }

    // Check for tables
    const tables = question.prompt_html.match(/<table[^>]*>[\s\S]*?<\/table>/g) || [];
    if (tables.length > 0) {
      console.log(`   - Contains ${tables.length} table(s)`);
    }

    // Check for missing content
    const textContent = question.prompt_html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (textContent.length < 20) {
      issues.push({
        type: 'Missing Content',
        description: `Question text is very short (${textContent.length} characters) - may be missing content`
      });
    }
  } else {
    issues.push({
      type: 'Missing Content',
      description: 'No prompt HTML found'
    });
  }

  // Check choices for MCQ
  if (question.answer_type === 'MCQ' && question.choices) {
    const choiceCount = question.choices.length;
    console.log(`   - ${choiceCount} answer choices`);

    if (choiceCount !== 4) {
      issues.push({
        type: 'Content Issue',
        description: `Expected 4 choices, found ${choiceCount}`
      });
    }

    // Check if any choice is missing content
    question.choices.forEach((choice, i) => {
      if (!choice.text || choice.text.trim().length === 0) {
        issues.push({
          type: 'Missing Content',
          description: `Choice ${String.fromCharCode(65 + i)} is empty`
        });
      }
    });
  }

  if (issues.length > 0) {
    report.issuesFound += issues.length;
    report.issues.push({
      questionNumber: qNum,
      questionId: question.id,
      externalId: question.external_id,
      issues: issues
    });

    console.log(`   ⚠️  ${issues.length} issue(s) found:`);
    issues.forEach(issue => {
      console.log(`      - ${issue.type}: ${issue.description}`);
    });
  } else {
    console.log(`   ✓ No issues detected in data`);
  }

  console.log('');
});

// Save comprehensive report
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'visual_audit_report.json'),
  JSON.stringify(report, null, 2)
);

console.log(`\n========================================`);
console.log(`AUDIT SUMMARY`);
console.log(`========================================`);
console.log(`Skill: ${SKILL_CODE} - ${SKILL_NAME}`);
console.log(`Total questions checked: ${report.totalQuestions}`);
console.log(`Issues found: ${report.issuesFound}`);
console.log(`Questions with issues: ${report.issues.length}`);

if (report.issues.length > 0) {
  console.log(`\n========================================`);
  console.log(`ISSUES DETAIL`);
  console.log(`========================================`);

  report.issues.forEach(item => {
    console.log(`\nQuestion ${item.questionNumber} (ID: ${item.questionId.substring(0, 13)}...):`);
    item.issues.forEach(issue => {
      console.log(`  - ${issue.type}: ${issue.description}`);
    });
  });
}

console.log(`\nFull report saved to: ${path.join(OUTPUT_DIR, 'visual_audit_report.json')}\n`);
