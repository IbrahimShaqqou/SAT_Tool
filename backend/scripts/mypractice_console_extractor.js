// COPY AND PASTE THIS INTO BROWSER CONSOLE ON MYPRACTICE DETAILS PAGE
// It will automatically extract all questions and download as JSON

(async function extractAllQuestions() {
  console.log('🚀 Starting extraction...');

  const results = [];

  // Find table and all rows
  const table = document.querySelector('table');
  if (!table) {
    console.error('❌ No table found - make sure you are on the test details page');
    return;
  }

  const rows = table.querySelectorAll('tbody tr');
  const total = rows.length;

  console.log(`Found ${total} questions`);

  for (let i = 0; i < total; i++) {
    console.log(`Extracting ${i + 1}/${total}...`);

    const row = rows[i];
    const reviewBtn = row.querySelector('button');

    if (!reviewBtn) continue;

    // Click review
    reviewBtn.click();

    // Wait for modal
    await new Promise(r => setTimeout(r, 1000));

    // Get modal
    const modal = document.querySelector('.test-questions-modal');
    if (!modal) {
      console.warn(`No modal for question ${i + 1}`);
      continue;
    }

    // Extract question content
    const questionPanel = modal.querySelector('.question-panel');
    if (questionPanel) {
      const fullText = questionPanel.innerText;
      const fullHTML = questionPanel.innerHTML;

      // Get section from header
      const header = modal.querySelector('h4');
      const section = header ? header.innerText : '';

      results.push({
        questionNumber: i + 1,
        section: section,
        text: fullText,
        html: fullHTML
      });
    }

    // Close modal
    const closeBtn = modal.querySelector('button[data-cb-modal-close]');
    if (closeBtn) {
      closeBtn.click();
      await new Promise(r => setTimeout(r, 400));
    }
  }

  console.log(`✓ Extracted ${results.length} questions`);

  // Download as JSON
  const dataStr = JSON.stringify(results, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'practice_test_4_questions.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log('✓ Downloaded practice_test_4_questions.json');

  return results;
})();
