#!/usr/bin/env node
/**
 * Audit script for H.E. (Linear inequalities) questions
 * This script systematically checks all 70 questions for:
 * - Math rendering issues
 * - Oversized images
 * - Missing content
 */

const fs = require('fs');
const path = require('path');

// Load the math_norm.json file
const mathNormPath = path.join(__dirname, 'backend', 'data', 'math_norm.json');
const mathQuestions = JSON.parse(fs.readFileSync(mathNormPath, 'utf8'));

// Filter for H.E. skill questions
const heQuestions = mathQuestions.filter(q => q.meta?.skill_cd === 'H.E.');

console.log(`Found ${heQuestions.length} H.E. (Linear inequalities) questions`);
console.log('\nStarting visual audit...\n');

const issues = [];
let questionsChecked = 0;

for (const question of heQuestions) {
  questionsChecked++;
  const qId = question.uId;

  // Check 1: Math rendering - look for broken LaTeX patterns
  const allHtml = [
    question.stimulus_html || '',
    question.prompt_html || '',
    ...(question.choices_html || [])
  ].join(' ');

  // Check for common LaTeX/MathML issues
  if (allHtml.includes('alttext=') && allHtml.includes('undefined')) {
    issues.push({
      questionId: qId,
      issueType: 'parsing error',
      description: 'Undefined value in math alttext'
    });
  }

  if (allHtml.match(/<math[^>]*>\s*<\/math>/)) {
    issues.push({
      questionId: qId,
      issueType: 'missing content',
      description: 'Empty math tag found'
    });
  }

  // Check 2: Oversized images
  const imgMatches = allHtml.match(/<img[^>]*>/g) || [];
  for (const imgTag of imgMatches) {
    // Look for explicit width/height attributes that are very large
    const widthMatch = imgTag.match(/width=["']?(\d+)/);
    const heightMatch = imgTag.match(/height=["']?(\d+)/);

    if (widthMatch && parseInt(widthMatch[1]) > 800) {
      issues.push({
        questionId: qId,
        issueType: 'oversized image',
        description: `Image width ${widthMatch[1]}px exceeds 800px`
      });
    }

    if (heightMatch && parseInt(heightMatch[1]) > 600) {
      issues.push({
        questionId: qId,
        issueType: 'oversized image',
        description: `Image height ${heightMatch[1]}px exceeds 600px`
      });
    }
  }

  // Check 3: Missing content
  if (!question.prompt_html || question.prompt_html.trim().length < 10) {
    issues.push({
      questionId: qId,
      issueType: 'missing content',
      description: 'Prompt is empty or too short'
    });
  }

  if (!question.choices_html || question.choices_html.length === 0) {
    if (question.answer_type === 'MC') {
      issues.push({
        questionId: qId,
        issueType: 'missing content',
        description: 'Multiple choice question has no answer choices'
      });
    }
  }

  // Check for incomplete math rendering (unclosed tags)
  if (allHtml.match(/<math[^>]*>(?!.*<\/math>)/)) {
    issues.push({
      questionId: qId,
      issueType: 'parsing error',
      description: 'Unclosed math tag'
    });
  }
}

console.log('='.repeat(70));
console.log(`Skill: H.E. - Linear inequalities in one or two variables`);
console.log(`Total questions checked: ${questionsChecked}`);
console.log(`Issues found: ${issues.length}`);
console.log('='.repeat(70));
console.log();

if (issues.length === 0) {
  console.log('No issues detected in static analysis!');
  console.log('\nNote: This is a static analysis only. For visual verification,');
  console.log('browser-based rendering checks are recommended.');
} else {
  // Group issues by question
  const issuesByQuestion = {};
  for (const issue of issues) {
    if (!issuesByQuestion[issue.questionId]) {
      issuesByQuestion[issue.questionId] = [];
    }
    issuesByQuestion[issue.questionId].push(issue);
  }

  console.log('Issues by question:\n');
  for (const [qId, qIssues] of Object.entries(issuesByQuestion)) {
    console.log(`Question ID: ${qId}`);
    for (const issue of qIssues) {
      console.log(`  - Issue type: ${issue.issueType}`);
      console.log(`    Visual description: ${issue.description}`);
    }
    console.log();
  }
}

// Save results to file
const results = {
  skill: 'H.E. - Linear inequalities in one or two variables',
  totalQuestionsChecked: questionsChecked,
  issuesFound: issues.length,
  issues: issues
};

fs.writeFileSync(
  path.join(__dirname, 'he_audit_results.json'),
  JSON.stringify(results, null, 2)
);

console.log('Results saved to: he_audit_results.json');
