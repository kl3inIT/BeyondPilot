import { useTranslations } from "next-intl";

/**
 * The frame of the operators' area. It does not check who is asking: each page does, through
 * `requireRole`, because a layout is not rendered again between its pages.
 */
export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const t = useTranslations("Site");

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {t("skipToContent")}
      </a>
      <main id="content" className="flex flex-1 flex-col">
        {children}
      </main>
    </>
  );
}
