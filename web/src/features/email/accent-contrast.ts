/** The least contrast text needs against its background to be read (WCAG 2.2, 1.4.3). */
export const READABLE_CONTRAST = 4.5;

/**
 * How strongly white text stands out on a colour given as six hex digits, from 1 (none) to 21:
 * the contrast ratio of WCAG. Buttons of an email are this colour with white text on them.
 */
export function contrastWithWhite(hex: string): number {
  const channel = (start: number) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05);
}
