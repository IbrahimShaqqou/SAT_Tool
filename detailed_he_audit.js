#!/usr/bin/env node
/**
 * Detailed audit script for H.E. (Linear inequalities) questions
 * Performs comprehensive HTML analysis
 */

const fs = require('fs');
const path = require('path');

// Load the math_norm.json file
const mathNormPath = path.join(__dirname, 'backend', 'data', 'math_norm.json');
const mathQuestions = JSON.parse(fs.readFileSync(mathNormPath, 'utf8'));

// Filter for H.E. skill questions
const heQuestions = mathQuestions.filter(q => q.meta?.skill_cd === 'H.E.');

console.log(`\n${'='.repeat(70)}`);
console.log(`Skill: H.E. - Linear inequalities in one or two variables`);
console.log(`Total questions checked: ${heQuestions.length}`);
console.log(`${'='.repeat(70)}\n`);

const issues = [];
let questionNumber = 0;

for (const question of heQuestions) {
  questionNumber++;
  const qId = question.uId;
  const questionIssues = [];

  // Collect all HTML content
  const stimulus = question.stimulus_html || '';
  const prompt = question.prompt_html || '';
  const choices = question.choices_html || [];
  const allHtml = stimulus + ' ' + prompt + ' ' + choices.join(' ');

  // CHECK 1: Math rendering - look for broken or malformed math tags
  const mathTags = allHtml.match(/<math[^>]*>.*?<\/math>/gs) || [];
  for (const mathTag of mathTags) {
    // Check for empty math tags
    const innerContent = mathTag.replace(/<\/?math[^>]*>/g, '').trim();
    if (innerContent.length < 3) {
      questionIssues.push({
        type: 'parsing error',
        description: 'Empty or nearly-empty math tag detected'
      });
    }

    // Check for common LaTeX errors
    if (mathTag.includes('alttext=""') || mathTag.includes('alttext=')) {
      const alttextMatch = mathTag.match(/alttext="([^"]*)"/);
      if (alttextMatch && alttextMatch[1] && alttextMatch[1].includes('undefined')) {
        questionIssues.push({
          type: 'parsing error',
          description: `Math alttext contains 'undefined': ${alttextMatch[1].substring(0, 100)}`
        });
      }
    }
  }

  // CHECK 2: Images - check for oversized or missing images
  const imgTags = allHtml.match(/<img[^>]*>/g) || [];
  for (const imgTag of imgTags) {
    // Extract src
    const srcMatch = imgTag.match(/src="([^"]*)"/);
    if (!srcMatch) {
      questionIssues.push({
        type: 'missing content',
        description: 'Image tag has no src attribute'
      });
      continue;
    }

    // Check for data URIs (base64 images) - these can be large
    if (srcMatch[1].startsWith('data:image')) {
      const dataSize = srcMatch[1].length;
      if (dataSize > 500000) { // > 500KB
        questionIssues.push({
          type: 'oversized image',
          description: `Base64 image is very large (~${Math.round(dataSize/1024)}KB)`
        });
      }
    }

    // Check for explicit width/height that might be oversized
    const widthMatch = imgTag.match(/width=["']?(\d+)/);
    const heightMatch = imgTag.match(/height=["']?(\d+)/);

    if (widthMatch) {
      const width = parseInt(widthMatch[1]);
      if (width > 1000) {
        questionIssues.push({
          type: 'oversized image',
          description: `Image width=${width}px is excessively large`
        });
      }
    }

    if (heightMatch) {
      const height = parseInt(heightMatch[1]);
      if (height > 800) {
        questionIssues.push({
          type: 'oversized image',
          description: `Image height=${height}px is excessively large`
        });
      }
    }

    // Check for style attributes with large dimensions
    const styleMatch = imgTag.match(/style="([^"]*)"/);
    if (styleMatch) {
      const style = styleMatch[1];
      const styleWidth = style.match(/width:\s*(\d+)px/);
      const styleHeight = style.match(/height:\s*(\d+)px/);

      if (styleWidth && parseInt(styleWidth[1]) > 1000) {
        questionIssues.push({
          type: 'oversized image',
          description: `Image style width=${styleWidth[1]}px is excessively large`
        });
      }

      if (styleHeight && parseInt(styleHeight[1]) > 800) {
        questionIssues.push({
          type: 'oversized image',
          description: `Image style height=${styleHeight[1]}px is excessively large`
        });
      }
    }
  }

  // CHECK 3: Missing content
  if (!prompt || prompt.trim().length < 10) {
    questionIssues.push({
      type: 'missing content',
      description: 'Question prompt is missing or too short'
    });
  }

  if (question.answer_type === 'MC' && (!choices || choices.length === 0)) {
    questionIssues.push({
      type: 'missing content',
      description: 'Multiple choice question has no answer choices'
    });
  }

  // CHECK 4: Malformed HTML
  // Check for unclosed tags (basic check)
  const openTags = (allHtml.match(/<(?!\/)[a-z][a-z0-9]*[^>]*>/gi) || []).length;
  const closeTags = (allHtml.match(/<\/[a-z][a-z0-9]*>/gi) || []).length;
  const selfClosingTags = (allHtml.match(/<[a-z][a-z0-9]*[^>]*\/>/gi) || []).length;

  // Allow some tolerance (self-closing tags like <br/>, <img/>)
  if (Math.abs(openTags - closeTags - selfClosingTags) > 3) {
    questionIssues.push({
      type: 'parsing error',
      description: `Possible unclosed HTML tags (open: ${openTags}, close: ${closeTags}, self-closing: ${selfClosingTags})`
    });
  }

  // CHECK 5: Look for garbled math symbols
  if (allHtml.match(/\?{3,}/)) {  // Multiple question marks in a row
    questionIssues.push({
      type: 'parsing error',
      description: 'Multiple consecutive question marks detected (possible encoding issue)'
    });
  }

  // Record issues
  if (questionIssues.length > 0) {
    issues.push({
      questionNumber,
      questionId: qId,
      issues: questionIssues
    });
  }
}

console.log(`Issues found: ${issues.length}\n`);

if (issues.length === 0) {
  console.log('✓ No issues detected! All questions appear well-formed.\n');
} else {
  console.log('Issues by question:\n');
  for (const item of issues) {
    console.log(`Question #${item.questionNumber}`);
    console.log(`Question ID: ${item.questionId}`);
    for (const issue of item.issues) {
      console.log(`  - Issue type: ${issue.type}`);
      console.log(`    Visual description: ${issue.description}`);
    }
    console.log();
  }
}

// Save detailed results
const results = {
  skill: 'H.E. - Linear inequalities in one or two variables',
  skillCode: 'H.E.',
  totalQuestionsChecked: heQuestions.length,
  questionsWithIssues: issues.length,
  issuesSummary: issues.map(i => ({
    questionNumber: i.questionNumber,
    questionId: i.questionId,
    issueCount: i.issues.length,
    issues: i.issues
  }))
};

const outputPath = path.join(__dirname, 'he_detailed_audit_results.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

console.log(`Detailed results saved to: ${outputPath}`);
