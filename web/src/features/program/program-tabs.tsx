import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { adminProgramQuestionsRoute, adminProgramRoute } from "@/lib/site";

/** The screens of one program in the admin: its Settings and the questions its form asks. */
async function ProgramTabs({ id, current }: { id: string; current: "settings" | "questions" }) {
  const t = await getTranslations("Admin.programs.tabs");
  const tabs = [
    { key: "settings", href: adminProgramRoute(id) },
    { key: "questions", href: adminProgramQuestionsRoute(id) },
  ] as const;
  return (
    <nav aria-label={t("label")} className="border-b">
      <ul className="flex gap-6">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={tab.key === current ? "page" : undefined}
              className={
                tab.key === current
                  ? "inline-flex min-h-11 items-center border-b-2 border-foreground text-sm font-medium outline-none focus-visible:underline"
                  : "inline-flex min-h-11 items-center border-b-2 border-transparent text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
              }
            >
              {t(tab.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { ProgramTabs };
