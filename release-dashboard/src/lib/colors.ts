/**
 * Maps a staleness score (0 = fresh, 1 = fully stale) to a color
 * on a gradient from bright green (fresh sprout) to pale brown (autumn leaf).
 *
 * Uses HSL interpolation for a natural-looking progression:
 * green -> yellow-green -> yellow -> amber -> pale brown
 *
 * @param dark - When true, uses a palette tuned for dark backgrounds (higher
 * saturation, adjusted lightness) so the gradient remains legible on dark cards.
 */
export function getStalenessColor(score: number, dark = false): string {
  const clamped = Math.max(0, Math.min(1, score));

  const freshHue = 142;
  const freshSat = dark ? 72 : 71;
  const freshLight = dark ? 48 : 45;

  const staleHue = 30;
  const staleSat = dark ? 55 : 40;
  const staleLight = dark ? 58 : 59;

  const h = Math.round(freshHue + (staleHue - freshHue) * clamped);
  const s = Math.round(freshSat + (staleSat - freshSat) * clamped);
  const l = Math.round(freshLight + (staleLight - freshLight) * clamped);

  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function getStalenessScore(
  commitsBehind: number,
  commitCeiling: number
): number {
  if (commitCeiling <= 0) return 0;
  return Math.min(commitsBehind / commitCeiling, 1);
}
