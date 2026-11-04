// Normalise Indian phone numbers to +91XXXXXXXXXX so duplicate checks
// match "98250 11223", "098250-11223" and "+91 9825011223" as one lead.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "+91" + digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  return digits ? "+" + digits : "";
}

export function isValidIndianMobile(raw: string): boolean {
  const n = normalizePhone(raw);
  return /^\+91[6-9]\d{9}$/.test(n);
}
