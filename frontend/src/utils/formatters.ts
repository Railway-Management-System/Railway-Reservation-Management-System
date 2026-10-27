/**
 * Unified Formatting Utilities for Railway Reservation & Management System
 * Enforces strict date and currency conventions:
 * 1. All date-times from API are India time strings "YYYY-MM-DD HH:MM:SS" without Z.
 *    NEVER pass them to new Date() and never convert time zones.
 *    Formatted as: "27 Oct 2026, 14:30" or "27 Oct 2026".
 * 2. Money formatted with ₹ prefix and Indian number grouping (e.g. ₹1,234.50).
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatIndiaDateTime(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== 'string') return '—';
  const cleaned = dateStr.replace(/Z$/, '').trim();
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return dateStr;
  const [, year, month, day, hour, min] = match;
  const monthName = MONTH_NAMES[parseInt(month, 10) - 1] || month;
  const dayNum = parseInt(day, 10);
  if (hour !== undefined && min !== undefined) {
    return `${dayNum} ${monthName} ${year}, ${hour}:${min}`;
  }
  return `${dayNum} ${monthName} ${year}`;
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₹0.00';
  const num = Number(amount);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
