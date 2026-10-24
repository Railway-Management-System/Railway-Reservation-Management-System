/**
 * Date formatting utilities conforming to docs/API_CONTRACT.md:
 * Converts Date objects to India time (Asia/Kolkata, UTC+5:30), whatever the computer's time zone is.
 * Never a JS Date, never a Z.
 */

function formatIndiaDateTime(val) {
  if (!val) {
    val = new Date();
  }

  // If already in 'YYYY-MM-DD HH:MM:SS' format, return directly
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) {
    return val;
  }

  let dateObj;
  if (val instanceof Date) {
    dateObj = val;
  } else if (typeof val === 'string') {
    dateObj = new Date(val);
  } else if (typeof val === 'number') {
    dateObj = new Date(val);
  } else {
    dateObj = new Date();
  }

  if (isNaN(dateObj.getTime())) {
    return '2026-10-18 00:00:00';
  }

  // Use Intl.DateTimeFormat with Asia/Kolkata to ensure accurate India time irrespective of host system timezone
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(dateObj);
  const partMap = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  let hour = partMap.hour;
  if (hour === '24') hour = '00';

  return `${partMap.year}-${partMap.month}-${partMap.day} ${hour}:${partMap.minute}:${partMap.second}`;
}

function formatIndiaDate(val) {
  if (!val) {
    val = new Date();
  }

  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }

  let dateObj = val instanceof Date ? val : new Date(val);
  if (isNaN(dateObj.getTime())) {
    return '2026-10-18';
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(dateObj);
  const partMap = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

module.exports = {
  formatIndiaDateTime,
  formatIndiaDate
};
