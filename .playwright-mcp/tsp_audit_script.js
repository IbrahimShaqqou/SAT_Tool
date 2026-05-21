// TSP Visual Audit Script
const fs = require('fs');

const questionIds = JSON.parse(fs.readFileSync('./tsp-full-response.json', 'utf8')).items.map(q => q.id);

console.log(JSON.stringify({
  totalQuestions: questionIds.length,
  ids: questionIds
}, null, 2));
