// Extract all questions from MyPractice page
// Run this in browser console on the details page

async function extractAllQuestions() {
  const results = [];

  // Find all review buttons
  const reviewButtons = Array.from(document.querySelectorAll('button'))
    .filter(btn => btn.textContent.trim() === 'Review');

  console.log(`Found ${reviewButtons.length} questions to extract`);

  for (let i = 0; i < reviewButtons.length; i++) {
    console.log(`Extracting question ${i + 1}/${reviewButtons.length}...`);

    // Click the review button
    reviewButtons[i].click();

    // Wait for dialog to open
    await new Promise(resolve => setTimeout(resolve, 500));

    // Extract question content
    const questionData = extractQuestionFromPage();

    if (questionData) {
      results.push({
        questionNumber: i + 1,
        ...questionData
      });
    }

    // Close the dialog
    const closeButton = document.querySelector('button[aria-label*="Close"]') ||
                       document.querySelector('button:contains("Close")') ||
                       Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Close'));

    if (closeButton) {
      closeButton.click();
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Download as JSON
  const dataStr = JSON.stringify(results, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mypractice_questions.json';
  link.click();

  console.log('✓ Extracted', results.length, 'questions');
  return results;
}

function extractQuestionFromPage() {
  // Look for the question content in various possible containers
  const containers = [
    document.querySelector('dialog'),
    document.querySelector('[role="dialog"]'),
    document.querySelector('.question-content'),
    document.querySelector('[data-question]')
  ].filter(Boolean);

  if (containers.length === 0) {
    console.warn('Could not find question container');
    return null;
  }

  const container = containers[0];

  // Extract all text
  const allText = container.innerText;

  // Try to find stimulus (passage)
  const stimulusEl = container.querySelector('[class*="stimulus"]') ||
                     container.querySelector('[class*="passage"]') ||
                     container.querySelector('p');
  const stimulus = stimulusEl ? stimulusEl.innerText : '';

  // Try to find prompt (question)
  const promptEl = container.querySelector('[class*="prompt"]') ||
                   container.querySelector('[class*="question"]');
  const prompt = promptEl ? promptEl.innerText : '';

  // Try to find choices
  const choiceEls = container.querySelectorAll('[class*="choice"]') ||
                    container.querySelectorAll('[role="radio"]') ||
                    container.querySelectorAll('input[type="radio"] + label');
  const choices = Array.from(choiceEls).map(el => el.innerText);

  // Try to find correct answer
  const correctEl = container.querySelector('[class*="correct"]') ||
                    container.querySelector('.answer');
  const correctAnswer = correctEl ? correctEl.innerText : '';

  return {
    stimulus,
    prompt,
    choices,
    correctAnswer,
    fullText: allText,
    html: container.innerHTML
  };
}

// Run the extraction
extractAllQuestions();
