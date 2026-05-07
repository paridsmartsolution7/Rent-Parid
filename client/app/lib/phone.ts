/**
 * Phone-number helpers for the customer auth + profile forms.
 *
 *   normalizePhone("0682368584")        -> "+355682368584"  (Albanian local → intl)
 *   normalizePhone("+355682368584")     -> "+355682368584"  (already intl)
 *   normalizePhone("+30 21 1234 5678")  -> "+302112345678"  (any country, spaces stripped)
 *   normalizePhone("355 6 8236 8584")   -> "+3556823 68584" -> normalised
 *
 * isValidPhone(): allows + then 7–15 digits (E.164), OR a leading 0 followed
 *   by 8 more digits (Albanian local), OR a digits-only string starting with
 *   a country code that we'll prefix with `+`.
 */

const STRIP_NON_DIGITS_KEEP_PLUS = /[^\d+]/g;
const ALBANIA_CC = '355';

/** Best-effort normaliser → returns canonical "+CC..." digits, or '' if invalid. */
export function normalizePhone(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(STRIP_NON_DIGITS_KEEP_PLUS, '');

  // Already in international form
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (digits.length < 7 || digits.length > 15) return '';
    return `+${digits}`;
  }

  // Local Albanian: starts with 0, total 9-10 digits → +355 + (drop the 0)
  if (cleaned.startsWith('0')) {
    const rest = cleaned.slice(1);
    if (rest.length < 7 || rest.length > 12) return '';
    return `+${ALBANIA_CC}${rest}`;
  }

  // Bare digits (no + and no leading 0) — assume the user typed the country
  // code without the plus (e.g. "355682368584" or "30211234567"). Add the plus.
  if (/^\d+$/.test(cleaned) && cleaned.length >= 8 && cleaned.length <= 15) {
    return `+${cleaned}`;
  }

  return '';
}

/** Lightweight live validator (good enough for client-side feedback). */
export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== '';
}
