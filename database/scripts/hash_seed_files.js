const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getDirHashes(dirPath) {
  const files = fs.readdirSync(dirPath).filter(f => !fs.statSync(path.join(dirPath, f)).isDirectory());
  files.sort();
  const hashes = {};
  for (const f of files) {
    hashes[f] = hashFile(path.join(dirPath, f));
  }
  return hashes;
}

const mysqlDir = path.join(__dirname, '../seed-data/mysql');
const mongoDir = path.join(__dirname, '../seed-data/mongodb');

const mysqlHashes = getDirHashes(mysqlDir);
const mongoHashes = getDirHashes(mongoDir);

const output = {
  timestamp: new Date().toISOString(),
  mysql: mysqlHashes,
  mongo: mongoHashes
};

fs.writeFileSync(path.join(__dirname, 'seed_hashes_before.json'), JSON.stringify(output, null, 2));
console.log(`Saved hashes for ${Object.keys(mysqlHashes).length} MySQL files and ${Object.keys(mongoHashes).length} Mongo files.`);
