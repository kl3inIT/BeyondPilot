/**
 * What the editor works out about a template's tags by itself: which of a kind's variables are
 * switches, and where a text that the backend refused as badly written goes wrong. The backend
 * stays the judge of whether a template can be saved; this only finds the place and the words.
 */

/** A place where the tags of a text are not written correctly. */
type TagFault = {
  /**
   * `unclosed`: a tag is opened and never closed. `forbidden`: a kind of tag templates may not use.
   * `unended`: a condition starts and never ends. `unopened`: a condition ends and never started.
   */
  kind: "unclosed" | "forbidden" | "unended" | "unopened";
  from: number;
  to: number;
  /** The line it is on, counted from 1. */
  line: number;
  /** The forbidden opening as written, such as `{{{`. */
  tag?: string;
  /** The condition that does not start or does not end. */
  name?: string;
};

/** Unescaped values, partials, delimiter changes and inheritance, as the backend refuses them. */
const FORBIDDEN = /^\{\{\s*[{&>=<$]/;

/** Where the tags of a text go wrong, in the order they stand in it. */
export function tagFaults(text: string): TagFault[] {
  const faults: TagFault[] = [];
  const open: { name: string; from: number; to: number }[] = [];
  const fault = (kind: TagFault["kind"], from: number, to: number, more?: Partial<TagFault>) =>
    faults.push({ kind, from, to, line: text.slice(0, from).split("\n").length, ...more });

  let at = text.indexOf("{{");
  while (at >= 0) {
    const forbidden = FORBIDDEN.exec(text.slice(at));
    if (forbidden) {
      fault("forbidden", at, at + forbidden[0].length, { tag: forbidden[0].replace(/\s+/g, "") });
      at = text.indexOf("{{", at + forbidden[0].length);
      continue;
    }
    const close = text.indexOf("}}", at + 2);
    const next = text.indexOf("{{", at + 2);
    if (close < 0 || (next >= 0 && next < close)) {
      fault("unclosed", at, at + 2);
      at = next;
      continue;
    }
    const tag = /^([#^/])\s*([\w.]+)$/.exec(text.slice(at + 2, close).trim());
    if (tag?.[1] === "/") {
      const name = tag[2]!;
      if (open.some((section) => section.name === name)) {
        // What was opened inside it and not closed before it never ends.
        for (let inner = open.pop()!; inner.name !== name; inner = open.pop()!) {
          fault("unended", inner.from, inner.to, { name: inner.name });
        }
      } else {
        fault("unopened", at, close + 2, { name });
      }
    } else if (tag) {
      open.push({ name: tag[2]!, from: at, to: close + 2 });
    }
    at = text.indexOf("{{", close + 2);
  }
  for (const section of open) {
    fault("unended", section.from, section.to, { name: section.name });
  }
  return faults.sort((one, other) => one.from - other.from);
}

/**
 * The variables of a kind that are switches: those its default wording only ever uses to show or
 * hide a piece of text, and never prints. A value that is sometimes absent is not one, since the
 * default wording prints it inside the piece it shows. The API names the variables without their
 * type, so the default wording, which the backend wrote for these variables, is what tells.
 *
 * @param names the variables the kind offers
 * @param defaults the default subject and body
 */
export function switchVariables(names: readonly string[], ...defaults: string[]): Set<string> {
  const printed = new Set<string>();
  const sections = new Set<string>();
  for (const text of defaults) {
    for (const [, mark, name] of text.matchAll(/\{\{([#^/]?)\s*([\w.]+)\s*\}\}/g)) {
      (mark ? sections : printed).add(name!);
    }
  }
  return new Set(names.filter((name) => sections.has(name) && !printed.has(name)));
}
