const fs = require('fs');
const path = require('path');

const SEED_MYSQL_DIR = path.resolve(__dirname, '../seed-data/mysql');
const SEED_MONGODB_DIR = path.resolve(__dirname, '../seed-data/mongodb');
const DATASETS_DIR = path.resolve(__dirname, '../../datasets');
const MOCK_DATA_DIR = path.resolve(__dirname, '../../mock-data');

if (!fs.existsSync(SEED_MYSQL_DIR)) fs.mkdirSync(SEED_MYSQL_DIR, { recursive: true });
if (!fs.existsSync(SEED_MONGODB_DIR)) fs.mkdirSync(SEED_MONGODB_DIR, { recursive: true });

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv(filePath, headers, rows) {
  const ws = fs.createWriteStream(filePath, { encoding: 'utf8' });
  ws.write(headers.join(',') + '\n');
  for (const row of rows) {
    const line = headers.map(h => escapeCsv(row[h])).join(',');
    ws.write(line + '\n');
  }
  ws.end();
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Deterministic Pseudo-Random Number Generator (Mulberry32)
function createRng(seed = 123456789) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = {
  SEED_MYSQL_DIR,
  SEED_MONGODB_DIR,
  DATASETS_DIR,
  MOCK_DATA_DIR,
  escapeCsv,
  writeCsv,
  writeJson,
  createRng
};
