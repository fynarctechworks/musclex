/**
 * Convert a numeric amount into Indian-English words (lakh/crore system).
 * Required on GST tax invoices.
 *
 * Examples:
 *   1234.56  -> "One Thousand Two Hundred Thirty Four and 56/100 Rupees"
 *   100000   -> "One Lakh Rupees Only"
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function under1000(n: number): string {
  if (n === 0) return '';
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(ONES[Math.floor(n / 100)], 'Hundred');
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)]);
    n %= 10;
  }
  if (n > 0) parts.push(ONES[n]);
  return parts.filter(Boolean).join(' ');
}

function intToWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1_000);
  n %= 1_000;
  if (crore) parts.push(`${under1000(crore)} Crore`);
  if (lakh) parts.push(`${under1000(lakh)} Lakh`);
  if (thousand) parts.push(`${under1000(thousand)} Thousand`);
  if (n) parts.push(under1000(n));
  return parts.join(' ');
}

export function numberToIndianWords(amount: number, currency = 'INR'): string {
  if (!Number.isFinite(amount)) return '';
  const sign = amount < 0 ? 'Minus ' : '';
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);
  const unit = currency === 'INR' ? 'Rupees' : currency;
  let result = `${sign}${intToWords(rupees)} ${unit}`;
  if (paise > 0) result += ` and ${intToWords(paise)} Paise`;
  return `${result} Only`;
}
