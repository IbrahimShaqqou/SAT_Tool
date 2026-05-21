const fs = require('fs');
const https = require('http');

// Fetch all questions for skill 37
const skillId = 37;
const apiUrl = `http://localhost:8000/api/v1/questions?skill_id=${skillId}&limit=102`;

function fetchQuestions() {
  return new Promise((resolve, reject) => {
    https.get(apiUrl, (res) => {
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

async function auditQuestions() {
  console.log('Fetching questions for skill 37 (Equivalent expressions)...\n');

  const response = await fetchQuestions();
  const questions = response.items;
  const total = response.total;

  console.log(`Total questions found: ${total}\n`);

  const issues = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const questionNum = i + 1;

    console.log(`[${questionNum}/${total}] Checking question ${q.id}...`);

    // Check for potential parsing issues
    const html = q.prompt_html || '';
    const stimulus = q.stimulus_html || '';
    const fullHtml = stimulus + html;

    // Check for broken LaTeX or MathML
    if (fullHtml.includes('alttext') && !fullHtml.includes('<math')) {
      issues.push({
        questionId: q.id,
        questionNum,
        issueType: 'parsing error',
        description: 'Contains alttext but missing <math> tags - possible broken MathML'
      });
    }

    // Check for oversized image references
    const imgMatches = fullHtml.match(/<img[^>]*>/g) || [];
    if (imgMatches.length > 0) {
      for (const img of imgMatches) {
        // Check if image has inline width/height that's very large
        const widthMatch = img.match(/width[=:]["']?(\d+)/i);
        const heightMatch = img.match(/height[=:]["']?(\d+)/i);

        if (widthMatch && parseInt(widthMatch[1]) > 800) {
          issues.push({
            questionId: q.id,
            questionNum,
            issueType: 'oversized image',
            description: `Image width ${widthMatch[1]}px exceeds reasonable bounds`
          });
        }
        if (heightMatch && parseInt(heightMatch[1]) > 600) {
          issues.push({
            questionId: q.id,
            questionNum,
            issueType: 'oversized image',
            description: `Image height ${heightMatch[1]}px exceeds reasonable bounds`
          });
        }
      }
    }

    // Check for missing content
    if (!html || html.trim().length === 0) {
      issues.push({
        questionId: q.id,
        questionNum,
        issueType: 'missing content',
        description: 'prompt_html is empty or missing'
      });
    }

    // Check for incomplete math rendering
    if (fullHtml.includes('\\(') && !fullHtml.includes('\\)')) {
      issues.push({
        questionId: q.id,
        questionNum,
        issueType: 'parsing error',
        description: 'Unmatched LaTeX inline math delimiters'
      });
    }

    if (fullHtml.includes('\\[') && !fullHtml.includes('\\]')) {
      issues.push({
        questionId: q.id,
        questionNum,
        issueType: 'parsing error',
        description: 'Unmatched LaTeX display math delimiters'
      });
    }
  }

  // Generate report
  console.log('\n===========================================');
  console.log('AUDIT REPORT');
  console.log('===========================================\n');
  console.log(`Skill: P.A. - Equivalent expressions`);
  console.log(`Total questions checked: ${total}`);
  console.log(`Issues found: ${issues.length}\n`);

  if (issues.length === 0) {
    console.log('No issues detected in API-level inspection.');
    console.log('Visual inspection via browser still recommended for:');
    console.log('- Math rendering quality');
    console.log('- Image display sizes');
    console.log('- Layout problems\n');
  } else {
    issues.forEach(issue => {
      console.log(`- Question #${issue.questionNum} (ID: ${issue.questionId})`);
      console.log(`  Issue type: ${issue.issueType}`);
      console.log(`  Description: ${issue.description}\n`);
    });
  }

  // Save report to JSON
  const report = {
    skill: 'P.A. - Equivalent expressions',
    skillId: 37,
    totalQuestionsChecked: total,
    issuesFound: issues.length,
    issues,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    '/Users/ibrahim/Desktop/SAT/SAT_Tool/.playwright-mcp/skill_37_audit_report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('Report saved to: skill_37_audit_report.json');
}

auditQuestions().catch(console.error);
