/**
 * The consent text the backend serves, split where the screen puts its boxes: the sections read
 * before them, the words of each box, and what follows. The boxes take their words from the text
 * itself, so a person agrees to exactly the version recorded with their choice. The text's own
 * "(Required)" and the like are left out of a box's words, since the box carries a badge for it.
 */
type ConsentText = { body: string; boxes: string[]; closing: string };

/** The heading the text introduces its boxes with. */
const BOXES = /^##\s+\d+\.\s+Your consent\s*$/m;

function splitConsentText(text: string): ConsentText {
  const heading = BOXES.exec(text);
  if (!heading) {
    return { body: text.trim(), boxes: [], closing: "" };
  }
  const body = text.slice(0, heading.index).trim();
  const rest = text.slice(heading.index + heading[0].length).split("\n");
  const boxes: string[] = [];
  let index = 0;
  for (; index < rest.length; index++) {
    const line = rest[index].trim();
    if (line.startsWith("- ")) {
      boxes.push(
        line
          .slice(2)
          .replace(/\s*\([^)]*\)\s*$/, "")
          .trim(),
      );
    } else if (line !== "" || boxes.length > 0) {
      break;
    }
  }
  return { body, boxes, closing: rest.slice(index).join("\n").trim() };
}

export { splitConsentText, type ConsentText };
