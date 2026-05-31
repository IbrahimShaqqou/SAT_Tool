// Extract just the correct answers from mypractice table
// Copy and paste this into browser console

(function() {
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  const answers = [];

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 3) {
      const questionNum = cells[0].textContent.trim();
      const section = cells[1].textContent.trim();
      const correctAnswer = cells[2].textContent.trim();

      answers.push({
        q: parseInt(questionNum),
        section: section,
        answer: correctAnswer
      });
    }
  });

  console.log('Extracted answers:', answers);
  console.log('\nFormatted for Module 1 (Q1-49):');

  const module1 = answers.filter(a => a.q <= 49);
  module1.forEach(a => {
    console.log(`Q${a.q}: ${a.answer}`);
  });

  // Copy to clipboard
  const formatted = module1.map(a => `Q${a.q}: ${a.answer}`).join('\n');
  copy(formatted);

  console.log('\n✓ Module 1 answers copied to clipboard!');

  return answers;
})();
