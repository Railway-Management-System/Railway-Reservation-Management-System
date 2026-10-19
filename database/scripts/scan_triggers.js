const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');

const filesToScan = [
  'database/README.md',
  'database/mysql/README.md',
  'README.md',
  'docs/BUSINESS_RULES.md',
  'docs/DATA_SCHEMA.md',
  'docs/API_CONTRACT.md',
  'database/FINALx4_Railway Reservation & Management System – ER Diagram.html',
  'database/mysql/01_schema.sql',
  'database/mysql/02_functions.sql',
  'database/mysql/03_procedures.sql',
  'database/mysql/04_triggers.sql',
  'database/mysql/05_views.sql',
  'database/mysql/06_reports.sql',
  'database/mysql/07_tests.sql'
];

const patterns = [
  /trg_[a-zA-Z0-9_]+/g,
  /TRIGGER\s+([a-zA-Z0-9_]+)/gi
];

const found = [];

for (const relPath of filesToScan) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;
  const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    const matches = line.match(/trg_[a-zA-Z0-9_]+/g);
    if (matches) {
      matches.forEach(m => {
        found.push({ file: relPath, line: idx + 1, match: m, text: line.trim() });
      });
    }
  });
}

console.log('=== BEFORE: ALL TRIGGER REFERENCES FOUND IN REPO ===');
found.forEach((item, idx) => {
  console.log(`${idx + 1}. [${item.file}:${item.line}] ${item.match} -> ${item.text}`);
});
