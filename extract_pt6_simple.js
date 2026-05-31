// Simpler extraction - just get ALL answers from table
// Table must be showing all rows (click "All" first)

const rows = document.querySelectorAll('table tbody tr');
const answers = [];

rows.forEach(row => {
  const qNum = row.cells[0]?.textContent.trim();
  const answer = row.cells[2]?.textContent.trim();
  if (qNum && answer) {
    answers.push(`Q${qNum}: ${answer}`);
  }
});

console.log(answers.join('\n'));
console.log(`\n✓ Extracted ${answers.length} answers`);

// Module 1 only (Q1-27 R/W + Q55-76 Math = 49 total)
const module1 = answers.slice(0, 27).concat(answers.slice(54, 76));
console.log('\n=== MODULE 1 ANSWERS (49 questions) ===');
console.log(module1.join('\n'));
