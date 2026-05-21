/**
 * Audit Script for Skill P.B. Questions
 * Checks all 148 questions for visual issues
 */

const issues = [];
let currentQuestionNumber = 1;

// Function to check current question for issues
function auditCurrentQuestion() {
  const questionNum = document.querySelector('[class*="text-gray-500"]:has-text("of 148")')?.textContent || 'Unknown';

  const issue = {
    questionNumber: currentQuestionNumber,
    questionId: null,
    issues: []
  };

  // Check for broken math rendering
  const mathElements = document.querySelectorAll('math, [class*="math"]');
  mathElements.forEach(el => {
    if (el.textContent.includes('�') || el.textContent.includes('undefined') || el.offsetHeight === 0) {
      issue.issues.push('Broken math rendering detected');
    }
  });

  // Check for oversized images
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    if (img.offsetHeight > 800 || img.offsetWidth > 1000) {
      issue.issues.push(`Oversized image: ${img.offsetWidth}x${img.offsetHeight}px`);
    }
  });

  // Check for missing content
  const promptArea = document.querySelector('[class*="prose"]');
  if (promptArea && promptArea.textContent.trim().length < 10) {
    issue.issues.push('Missing or very short question text');
  }

  // Check for answer choices (for MCQ)
  const answerButtons = document.querySelectorAll('button[class*="answer"], button:has-text("A"), button:has-text("B")');
  if (answerButtons.length > 0 && answerButtons.length < 4) {
    issue.issues.push(`Incomplete answer choices: only ${answerButtons.length} found`);
  }

  if (issue.issues.length > 0) {
    return issue;
  }
  return null;
}

// Export function for external use
window.auditCurrentQuestion = auditCurrentQuestion;
