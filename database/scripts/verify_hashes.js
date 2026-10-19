const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

const beforeData = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed_hashes_before.json'), 'utf8'));

const mysqlDir = path.join(__dirname, '../seed-data/mysql');
const mongoDir = path.join(__dirname, '../seed-data/mongodb');

const changed = [];
const unchanged = [];

for (const [file, beforeHash] of Object.entries(beforeData.mysql)) {
  const currHash = hashFile(path.join(mysqlDir, file));
  if (currHash !== beforeHash) {
    changed.push({ dir: 'mysql', file, before: beforeHash, after: currHash });
  } else {
    unchanged.push({ dir: 'mysql', file });
  }
}

for (const [file, beforeHash] of Object.entries(beforeData.mongo)) {
  const currHash = hashFile(path.join(mongoDir, file));
  if (currHash !== beforeHash) {
    changed.push({ dir: 'mongo', file, before: beforeHash, after: currHash });
  } else {
    unchanged.push({ dir: 'mongo', file });
  }
}

console.log(`Unchanged files: ${unchanged.length}`);
console.log(`Changed files: ${changed.length}`);
if (changed.length > 0) {
  console.log('Changed files details:');
  console.table(changed);
}
