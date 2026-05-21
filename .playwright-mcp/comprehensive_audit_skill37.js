const http = require('http');
const fs = require('fs');

// Comprehensive audit for Skill 37 - Equivalent expressions
const skillId = 37;

function fetchQuestions() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: `/api/v1/questions?skill_id=${skillId}&limit=102`,
      method: 'GET'
    };

    http.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function analyzeQuestion(q, questionNum) {
  const issues = [];

  // Get all HTML content
  const prompt = q.prompt_html || '';
  const stimulus = q.stimulus_html || '';
  const choices = q.choices || [];

  const allHtml = stimulus + prompt + choices.map(c => c.html || '').join('');

  // 1. Check for parsing errors - malformed MathML
  if (allHtml.includes('<math') && allHtml.includes('alttext')) {
    // MathML is present - check for common issues

    // Check for unclosed math tags
    const mathOpenCount = (allHtml.match(/<math[^>]*>/g) || []).length;
    const mathCloseCount = (allHtml.match(/<\/math>/g) || []).length;
    if (mathOpenCount !== mathCloseCount) {
      issues.push({
        type: 'parsing error',
        description: `Mismatched <math> tags: ${mathOpenCount} open, ${mathCloseCount} close`
      });
    }

    // Check for broken/incomplete MathML structure
    if (allHtml.includes('<math') && !allHtml.includes('</math>')) {
      issues.push({
        type: 'parsing error',
        description: 'Math tag opened but never closed'
      });
    }
  }

  // 2. Check for LaTeX rendering issues
  if (allHtml.includes('\\(') || allHtml.includes('\\[')) {
    const inlineMathOpen = (allHtml.match(/\\\(/g) || []).length;
    const inlineMathClose = (allHtml.match(/\\\)/g) || []).length;
    const displayMathOpen = (allHtml.match(/\\\[/g) || []).length;
    const displayMathClose = (allHtml.match(/\\\]/g) || []).length;

    if (inlineMathOpen !== inlineMathClose) {
      issues.push({
        type: 'parsing error',
        description: `Unmatched LaTeX inline math: ${inlineMathOpen} open \\(, ${inlineMathClose} close \\)`
      });
    }

    if (displayMathOpen !== displayMathClose) {
      issues.push({
        type: 'parsing error',
        description: `Unmatched LaTeX display math: ${displayMathOpen} open \\[, ${displayMathClose} close \\]`
      });
    }
  }

  // 3. Check for oversized images
  const imgTags = allHtml.match(/<img[^>]*>/gi) || [];
  imgTags.forEach((imgTag, idx) => {
    // Check for explicit width/height attributes
    const widthMatch = imgTag.match(/width\s*=\s*["']?(\d+)/i);
    const heightMatch = imgTag.match(/height\s*=\s*["']?(\d+)/i);

    if (widthMatch && parseInt(widthMatch[1]) > 1000) {
      issues.push({
        type: 'oversized image',
        description: `Image ${idx + 1}: width=${widthMatch[1]}px (exceeds 1000px)`
      });
    }

    if (heightMatch && parseInt(heightMatch[1]) > 800) {
      issues.push({
        type: 'oversized image',
        description: `Image ${idx + 1}: height=${heightMatch[1]}px (exceeds 800px)`
      });
    }

    // Check for style attributes with large dimensions
    const styleMatch = imgTag.match(/style\s*=\s*["']([^"']*)["']/i);
    if (styleMatch) {
      const styleStr = styleMatch[1];
      const styleWidthMatch = styleStr.match(/width\s*:\s*(\d+)/i);
      const styleHeightMatch = styleStr.match(/height\s*:\s*(\d+)/i);

      if (styleWidthMatch && parseInt(styleWidthMatch[1]) > 1000) {
        issues.push({
          type: 'oversized image',
          description: `Image ${idx + 1}: CSS width=${styleWidthMatch[1]}px (exceeds 1000px)`
        });
      }

      if (styleHeightMatch && parseInt(styleHeightMatch[1]) > 800) {
        issues.push({
          type: 'oversized image',
          description: `Image ${idx + 1}: CSS height=${styleHeightMatch[1]}px (exceeds 800px)`
        });
      }
    }
  });

  // 4. Check for missing content
  if (!prompt || prompt.trim().length === 0) {
    issues.push({
      type: 'missing content',
      description: 'prompt_html is empty or missing'
    });
  }

  // For MCQ questions, check if choices are present
  if (q.answer_type === 'MCQ') {
    if (!choices || choices.length === 0) {
      issues.push({
        type: 'missing content',
        description: 'MCQ question has no answer choices'
      });
    } else if (choices.length < 4) {
      issues.push({
        type: 'missing content',
        description: `MCQ question has only ${choices.length} choices (expected 4)`
      });
    } else {
      // Check if any choice is empty
      choices.forEach((choice, idx) => {
        if (!choice.html || choice.html.trim().length === 0) {
          issues.push({
            type: 'missing content',
            description: `Answer choice ${choice.label || idx} is empty`
          });
        }
      });
    }
  }

  // 5. Check for suspicious patterns that might indicate rendering issues
  if (allHtml.includes('undefined') || allHtml.includes('null')) {
    issues.push({
      type: 'parsing error',
      description: 'HTML contains "undefined" or "null" - possible template error'
    });
  }

  // Check for excessive nested tags (might cause rendering issues)
  const maxNestingDepth = 20;
  let currentDepth = 0;
  let maxDepth = 0;
  for (let char of allHtml) {
    if (char === '<') currentDepth++;
    if (char === '>') {
      maxDepth = Math.max(maxDepth, currentDepth);
      currentDepth--;
    }
  }
  if (maxDepth > maxNestingDepth) {
    issues.push({
      type: 'parsing error',
      description: `Excessive HTML nesting (depth: ${maxDepth}, threshold: ${maxNestingDepth})`
    });
  }

  return issues;
}

async function audit() {
  console.log('===========================================');
  console.log('COMPREHENSIVE VISUAL AUDIT');
  console.log('Skill: P.A. - Equivalent expressions (ID: 37)');
  console.log('===========================================\n');

  const response = await fetchQuestions();
  const questions = response.items;
  const total = response.total;

  console.log(`Total questions to audit: ${total}\n`);

  const allIssues = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const questionNum = i + 1;

    const issues = analyzeQuestion(q, questionNum);

    if (issues.length > 0) {
      allIssues.push({
        questionNum,
        questionId: q.id,
        externalId: q.external_id,
        issues
      });
    }
  }

  // Generate report
  console.log('\n===========================================');
  console.log('AUDIT RESULTS');
  console.log('===========================================\n');
  console.log(`Skill: P.A. - Equivalent expressions`);
  console.log(`Total questions checked: ${total}`);
  console.log(`Issues found: ${allIssues.length} questions with issues\n`);

  if (allIssues.length === 0) {
    console.log('✓ No issues detected!');
    console.log('\nAll questions passed automated checks for:');
    console.log('  - Math rendering (LaTeX/MathML)');
    console.log('  - Image sizing');
    console.log('  - Content completeness');
    console.log('  - HTML structure\n');
  } else {
    allIssues.forEach(item => {
      console.log(`Question #${item.questionNum}`);
      console.log(`  ID: ${item.questionId}`);
      console.log(`  External ID: ${item.externalId}`);
      item.issues.forEach(issue => {
        console.log(`  - [${issue.type}] ${issue.description}`);
      });
      console.log('');
    });
  }

  // Save detailed report
  const report = {
    skill: {
      id: 37,
      code: 'P.A.',
      name: 'Equivalent expressions',
      domain: 'Problem Solving and Data Analysis'
    },
    audit: {
      timestamp: new Date().toISOString(),
      totalQuestions: total,
      questionsWithIssues: allIssues.length,
      issueCount: allIssues.reduce((sum, item) => sum + item.issues.length, 0)
    },
    findings: allIssues
  };

  const reportPath = '/Users/ibrahim/Desktop/SAT/SAT_Tool/.playwright-mcp/skill_37_comprehensive_audit.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\nDetailed report saved to: skill_37_comprehensive_audit.json`);
}

audit().catch(console.error);
