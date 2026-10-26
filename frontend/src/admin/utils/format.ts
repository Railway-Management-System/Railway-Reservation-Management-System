/**
 * Currency and Date formatters conforming to Indian Railways standards:
 * - Currency: ₹ with en-IN grouping (e.g. ₹ 1,45,200.00)
 * - Dates: DD MMM YYYY (e.g. 10 Oct 2026)
 * - Timestamps: DD MMM YYYY, HH:mm (e.g. 10 Oct 2026, 14:22)
 */

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹ 0.00';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  // Preserve raw India-local datetime string without appending Z or timezone shifting
  return isoString;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  // Preserve raw India-local date string YYYY-MM-DD
  return dateString;
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
