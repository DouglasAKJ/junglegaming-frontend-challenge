import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Validates that a string represents a valid non-negative decimal ETH amount.
 */
export function isValidEthString(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^\d+(\.\d+)?$/.test(value.trim());
}

/**
 * Adds two or more ETH decimal strings and returns a normalized string.
 */
export function addEth(...amounts: string[]): string {
  const sum = amounts.reduce(
    (acc, curr) => acc.plus(new Decimal(curr || '0')),
    new Decimal(0)
  );
  return formatEthPrecise(sum);
}

/**
 * Subtracts b from a (clamped at 0) and returns a normalized ETH string.
 */
export function subEth(a: string, b: string): string {
  const res = new Decimal(a || '0').minus(new Decimal(b || '0'));
  if (res.isNegative()) return '0.00';
  return formatEthPrecise(res);
}

/**
 * Multiplies an ETH decimal string by an integer quantity or decimal factor.
 */
export function mulEth(amount: string, factor: number | string): string {
  const res = new Decimal(amount || '0').times(new Decimal(factor));
  return formatEthPrecise(res);
}

/**
 * Calculates percentage discount of an ETH string (e.g., percent = 10 -> 10%).
 */
export function percentOfEth(amount: string, percent: number): string {
  const res = new Decimal(amount || '0').times(new Decimal(percent)).dividedBy(100);
  return formatEthPrecise(res);
}

/**
 * Formats a Decimal or string preserving at least 2 decimal places and up to 4 significant decimals without trailing zeros after 2nd place.
 */
export function formatEthPrecise(val: Decimal | string | number): string {
  const d = new Decimal(val || 0);
  // Round to at most 4 decimal places
  const fixed4 = d.toFixed(4);
  // Strip trailing zeros but keep at least 2 decimal places
  const trimmed = fixed4.replace(/(\.\d{2})\d*$/, (match) => {
    return match.replace(/0+$/, '').replace(/^(\.\d)$/, '$10');
  });
  // Simpler deterministic formatting:
  const parts = fixed4.split('.');
  let dec = parts[1].replace(/0+$/, '');
  if (dec.length < 2) {
    dec = dec.padEnd(2, '0');
  }
  return `${parts[0]}.${dec}`;
}

/**
 * Formats ETH value with unit suffix, e.g. "1.19 ETH" or "26.846 ETH"
 */
export function displayEth(amount: string | number): string {
  return `${formatEthPrecise(amount)} ETH`;
}

/**
 * Compares two ETH strings: returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareEth(a: string, b: string): number {
  return new Decimal(a || '0').cmp(new Decimal(b || '0'));
}
