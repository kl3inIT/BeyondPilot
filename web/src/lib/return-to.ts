const MAX_LENGTH = 2000;

/**
 * The path to return to after signing in, or `undefined` when the value is not a path of this
 * site. Anyone can write a link, so the value is judged the way a browser reads it: a backslash
 * counts as a slash, and tabs, line breaks and spaces are dropped, which would turn a harmless-looking
 * path into another site's address. The backend applies the same rule.
 */
export function localPath(value: string | null | undefined): string | undefined {
  if (
    !value ||
    value.length > MAX_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\s\p{Cc}]/u.test(value)
  ) {
    return undefined;
  }
  return value;
}
