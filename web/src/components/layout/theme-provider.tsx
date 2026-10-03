"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

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
    >
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
