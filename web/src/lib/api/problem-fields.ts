/**
 * The form field a validation problem points at: the JSON Pointer of a rejected member
 * (`#/keyDates/0/title`) as the field name a form uses (`keyDates[0].title`).
 */
export function fieldOfPointer(pointer: string): string {
  return pointer
    .replace(/^#\//, "")
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce(
      (name, segment) =>
        /^\d+$/.test(segment) ? `${name}[${segment}]` : name ? `${name}.${segment}` : segment,
      "",
    );
}
