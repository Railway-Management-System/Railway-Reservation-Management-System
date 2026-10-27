/**
 * Currency and Date formatters conforming to Indian Railways standards:
 * - Currency: ₹ with en-IN grouping (e.g. ₹ 1,45,200.00)
 * - Dates: DD MMM YYYY (e.g. 27 Oct 2026)
 * - Timestamps: DD MMM YYYY, HH:mm (e.g. 27 Oct 2026, 14:30)
 * HARD RULE: All API date-times are India time strings "YYYY-MM-DD HH:MM:SS" with no Z.
 * NEVER pass to new Date() and never convert time zones. Format strictly by string splitting.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₹ 0.00';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const trimmed = String(isoString).trim();
  const parts = trimmed.split(/[ T]/);
  const datePart = parts[0];
  const timePart = parts[1];

  if (!datePart) return trimmed;
  const dTokens = datePart.split('-');
  if (dTokens.length !== 3) return trimmed;

  const year = dTokens[0];
  const mIndex = parseInt(dTokens[1], 10) - 1;
  const day = parseInt(dTokens[2], 10);
  const monthName = MONTHS_SHORT[mIndex] || dTokens[1];

  let result = `${day} ${monthName} ${year}`;
  if (timePart) {
    const tTokens = timePart.split(':');
    if (tTokens.length >= 2) {
      result += `, ${tTokens[0]}:${tTokens[1]}`;
    }
  }
  return result;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const trimmed = String(dateString).trim();
  const datePart = trimmed.split(/[ T]/)[0];
  const dTokens = datePart.split('-');
  if (dTokens.length !== 3) return datePart;

  const year = dTokens[0];
  const mIndex = parseInt(dTokens[1], 10) - 1;
  const day = parseInt(dTokens[2], 10);
  const monthName = MONTHS_SHORT[mIndex] || dTokens[1];

  return `${day} ${monthName} ${year}`;
}

export function formatDelay(minutes: number): string {
  if (!minutes || minutes <= 0) return 'On Time';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m late`;
  }
  return `${mins}m late`;
}

