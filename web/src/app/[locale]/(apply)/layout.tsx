import { useTranslations } from "next-intl";

/** The application form: its own focused header, without the site's navigation and footer. */
export default function ApplyLayout({ children }: LayoutProps<"/[locale]">) {
  const t = useTranslations("Site");

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {t("skipToContent")}
      </a>
      <div id="content" className="flex flex-1 flex-col">
        {children}
      </div>
    </>
  );
}
