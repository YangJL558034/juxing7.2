const ID_CARD_PATTERN = /^\d{17}[\dXx]$/;
const MAINLAND_MOBILE_PATTERN = /^1[3-9]\d{9}$/;

export function normalizeIdCard(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

export function normalizeMobile(value: string) {
  return value.trim().replace(/\D/g, '');
}

export function isCompleteIdCard(value: string) {
  return ID_CARD_PATTERN.test(normalizeIdCard(value));
}

export function isCompleteMainlandMobile(value: string) {
  return MAINLAND_MOBILE_PATTERN.test(normalizeMobile(value));
}
