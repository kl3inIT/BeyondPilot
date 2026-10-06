"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * The theme script runs from the server's HTML before the page hydrates. React 19 warns about a
 * script a client component renders, so in the browser the same tag is typed as data, which React
 * leaves alone; the tag suppresses the hydration difference of its type.
 */
const scriptProps =
  typeof window === "undefined" ? undefined : ({ type: "application/json" } as const);

/**
 * Opens in the light theme, the one the design is drawn in; a visitor can pick dark or the system's
 * setting from the footer. tokens.css holds both.
 */
function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      scriptProps={scriptProps}
    >
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
