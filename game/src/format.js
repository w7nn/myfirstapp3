const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae'];

// 950 -> "950", 12_340 -> "12.3K", 4_560_000 -> "4.56M"
export function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  const value = Math.floor(n);
  if (value < 1000) return String(value);
  let tier = Math.min(Math.floor(Math.log10(value) / 3), SUFFIXES.length - 1);
  let scaled = value / 1000 ** tier;
  // 999_999 would round to "1000K"; show it as "1M" instead.
  if (scaled >= 999.5 && tier < SUFFIXES.length - 1) {
    tier += 1;
    scaled /= 1000;
  }
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  let shown = scaled.toFixed(digits);
  if (shown.includes('.')) shown = shown.replace(/\.?0+$/, '');
  return shown + SUFFIXES[tier];
}

// Income per second shows one decimal while small.
export function formatRate(n) {
  return n < 100 ? n.toFixed(1).replace(/\.0$/, '') : formatNumber(n);
}
