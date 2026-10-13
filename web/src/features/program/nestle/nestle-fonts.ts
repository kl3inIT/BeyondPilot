import { Lexend, Montserrat } from "next/font/google";

/**
 * The pair the client drew the Nestlé page with: Lexend for its text, Montserrat for its headings.
 * They are this page's own, as its colours are; the rest of the site is set in Inter (DESIGN.md).
 * Loaded here, they are fetched only by a visitor of this page.
 */
const nestleBody = Lexend({
  variable: "--font-nestle-body",
  subsets: ["latin", "vietnamese"],
});

const nestleDisplay = Montserrat({
  variable: "--font-nestle-display",
  subsets: ["latin", "vietnamese"],
});

export { nestleBody, nestleDisplay };
