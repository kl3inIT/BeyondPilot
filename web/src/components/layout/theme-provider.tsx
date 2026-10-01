"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Light and dark follow the system until the visitor picks one; tokens.css holds both. */
function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
