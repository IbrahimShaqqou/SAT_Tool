/**
 * Audit script for Probability and conditional probability questions (Skill Q.E., ID 41)
 * Saves visual snapshots and screenshots of each question for manual review
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SKILL_ID = 41;
const SKILL_CODE = 'Q.E.';
const SKILL_NAME = 'Probability and conditional probability';
const API_URL = 'http://localhost:8000/api/v1';
const FRONTEND_URL = 'http://localhost:3000';
const OUTPUT_DIR = './.playwright-mcp/skill_41_audit';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Fetch all questions for the skill
async function getQuestions() {
  const response = await fetch(`${API_URL}/questions?skill_id=${SKILL_ID}`);
  const data = await response.json();
  return data.items;
}

// Main audit function
async function auditQuestions() {
  console.log(`Starting audit for Skill ${SKILL_CODE} - ${SKILL_NAME}`);
  console.log(`API URL: ${API_URL}/questions?skill_id=${SKILL_ID}`);

  const questions = await getQuestions();
  console.log(`Found ${questions.length} questions to audit\n`);

  const report = {
    skill: {
      id: SKILL_ID,
      code: SKILL_CODE,
      name: SKILL_NAME
    },
    totalQuestions: questions.length,
    issuesFound: 0,
    issues: [],
    timestamp: new Date().toISOString()
  };

  // Save questions data
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'questions_data.json'),
    JSON.stringify(questions, null, 2)
  );

  // Create summary
  questions.forEach((q, index) => {
    console.log(`${index + 1}. Question ID: ${q.id}`);
    console.log(`   External ID: ${q.external_id}`);
    console.log(`   Difficulty: ${q.difficulty}`);
    console.log(`   Answer Type: ${q.answer_type}`);

    // Check for potential issues in the data
    const questionIssues = [];

    // Check if prompt_html exists and has content
    if (!q.prompt_html || q.prompt_html.trim() === '') {
      questionIssues.push({
        type: 'Missing Content',
        description: 'No prompt HTML found'
      });
    }

    // Check for large embedded images (base64)
    if (q.prompt_html && q.prompt_html.includes('data:image')) {
      const base64Match = q.prompt_html.match(/data:image\/[^;]+;base64,([^"]+)/g);
      if (base64Match) {
        base64Match.forEach((img, imgIndex) => {
          const sizeKB = Math.round((img.length * 0.75) / 1024);
          if (sizeKB > 100) {
            questionIssues.push({
              type: 'Oversized Image',
              description: `Embedded image ${imgIndex + 1} is ${sizeKB}KB (over 100KB threshold)`
            });
          }
        });
      }
    }

    // Check for math rendering tags
    if (q.prompt_html && (q.prompt_html.includes('<math') || q.prompt_html.includes('\\('))) {
      console.log(`   ✓ Contains math expressions`);
    }

    if (questionIssues.length > 0) {
      report.issuesFound += questionIssues.length;
      report.issues.push({
        questionNumber: index + 1,
        questionId: q.id,
        externalId: q.external_id,
        issues: questionIssues
      });

      console.log(`   ⚠️  Issues found: ${questionIssues.length}`);
      questionIssues.forEach(issue => {
        console.log(`      - ${issue.type}: ${issue.description}`);
      });
    }

    console.log('');
  });

  // Save report
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'audit_report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(`\n=== AUDIT SUMMARY ===`);
  console.log(`Skill: ${SKILL_CODE} - ${SKILL_NAME}`);
  console.log(`Total questions checked: ${report.totalQuestions}`);
  console.log(`Issues found: ${report.issuesFound}`);

  if (report.issues.length > 0) {
    console.log(`\nQuestions with issues:`);
    report.issues.forEach(item => {
      console.log(`\nQuestion ${item.questionNumber} (ID: ${item.questionId}):`);
      item.issues.forEach(issue => {
        console.log(`  - ${issue.type}: ${issue.description}`);
      });
    });
  }

  console.log(`\nReport saved to: ${path.join(OUTPUT_DIR, 'audit_report.json')}`);
}

// Run audit
auditQuestions().catch(console.error);
