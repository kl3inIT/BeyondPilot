Method: dual-agent (A: design review · B: deterministic Figma checks). The Impeccable detector does not apply to a Figma target; run on the old home code it returned 0 findings (context only).

## Score: 25/36 (69%, Acceptable). Previous run: 20/36 (56%)

| #   | Heuristic                       | Score | Key issue                                                               |
| --- | ------------------------------- | ----- | ----------------------------------------------------------------------- |
| 1   | Visibility of system status     | 3     | Countdown and stages clear; no search states                            |
| 2   | Match with the real world       | 3     | challenge / campaign / program used interchangeably                     |
| 3   | User control and freedom        | 3     | Menu closes and FAQ collapses; no clear-search                          |
| 4   | Consistency and standards       | 2     | Card titles at 14/16/18px; mixed cover styles; "See all" only on mobile |
| 5   | Error prevention                | 3     | ICT time and eligibility are stated but far apart                       |
| 6   | Recognition rather than recall  | 3     | Tab counts and menu hints; no search suggestions                        |
| 7   | Flexibility and efficiency      | n/a   | Persuade surface                                                        |
| 8   | Aesthetic and minimalist design | 3     | Tasco appears 3 times, WASH3000 twice                                   |
| 9   | Error recovery                  | 2     | No search-empty or error states (planned)                               |
| 10  | Help and documentation          | 3     | Task-focused FAQ with a contact email                                   |

Specificity: the top half is authored for this product; the bottom half (logos, founders, FAQ, footer) is the category template.
Deterministic checks (B):

- All solid fills and strokes are bound to variables, and gradients use paint styles.
- About 15 drop shadows per frame use no effect style (6 recipes).
- The 4 section H2s at 40px have no text style.
- Nothing overflows; mobile "Luma" is clipped by 1px (65:3308).

Priority issues:

1. [P1] AI solutions is a logo directory with no proof and no link (59:949). Add a sourced proof line or state it as unknown, plus "View solution →".
2. [P1] Use-case covers are event photos unrelated to the use case (59:846). Label them as GenAI Open Innovation Vietnam 2025, or use industry covers.
3. [P1] Mobile touch targets are under 44px (15 of 22): the Button `lg` is 40px, scope chips 26px, arrow links 20px. Add a 44px touch size and hit areas.
4. [P2] The hero subtitle contrast is 3.8–4.0:1 over the glow (57:258, 67:3789). Lower the glow behind the text or darken the text.
5. [P2] The mobile deadline path is weak: no 23:59 in the chip, Apply about 1,650px down, and no Open now row in the menu (59:1349, 67:3700).

Personas:

- Mobile provider: no time on the chip, no menu route, eligibility collapsed at the bottom.
- Enterprise lead: one 14px link, a provider-only FAQ, solutions without proof.
- First-time builder: nothing near Apply says solo builders are welcome.

Minor:

- The Open now pill looks like a primary button.
- The Programs tab repeats the timeline; desktop has no "See all".
- Diego Rojas's photo has a purple background.
- H2 text styles and shadow effect styles are missing.
- Partner logos are pale.
- The Luma line is not a link.
- The page ends without restating the deadline.
