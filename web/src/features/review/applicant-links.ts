/**
 * What an applicant typed, turned into the address of a link, or `null` when it must stay text.
 * An answer is shown as it was stored, and a reviewer follows a link by its label: nothing here
 * makes a link out of a value that would lead somewhere other than what the row says.
 */

/**
 * A link an applicant gave, when it is a web address. The backend takes only https links, but an
 * answer is shown as it was stored, so anything else is shown as text and never becomes a link.
 */
export function webAddress(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * A LinkedIn profile, when the address is one: https, on linkedin.com or a host under it, without
 * a user name in front of the host. The row is labelled "LinkedIn", so an address anywhere else
 * stays text.
 */
export function linkedinAddress(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const onLinkedin = host === "linkedin.com" || host.endsWith(".linkedin.com");
    return url.protocol === "https:" && onLinkedin && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** One mailbox: a name, an at sign and a host, with nothing a mail link reads as more than that. */
const MAILBOX = /^[^\s@,;:?&#%<>()[\]\\"]+@[^\s@,;:?&#%<>()[\]\\"]+$/;

/**
 * The address a mail link writes to, when the value is one plain mailbox. A value that names
 * several recipients or carries headers (`?subject=`, `&bcc=`) stays text.
 */
export function mailAddress(value: string): string | null {
  if (!MAILBOX.test(value)) {
    return null;
  }
  const at = value.indexOf("@");
  return `mailto:${encodeURIComponent(value.slice(0, at))}@${encodeURIComponent(value.slice(at + 1))}`;
}

/** The address a telephone link dials: the digits of what was given, with its leading plus. */
export function phoneAddress(value: string): string | null {
  const digits = value.replace(/[^\d+]/g, "");
  return /^\+?\d+$/.test(digits) ? `tel:${digits}` : null;
}
