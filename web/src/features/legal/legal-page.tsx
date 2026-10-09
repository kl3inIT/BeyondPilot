import { getFormatter, getTranslations } from "next-intl/server";

type LegalDoc = "privacy" | "terms";

type LegalSection = { heading: string; body?: string[]; items?: string[]; after?: string[] };

/** The day the policies below last changed; bump it with every change to their copy. */
const LAST_UPDATED = new Date("2026-10-08T00:00:00Z");

const anchor = (index: number) => `section-${index + 1}`;

/**
 * The Privacy Policy and the Terms of Service: a title, the date they last changed, a list of
 * their sections and the sections themselves, all read from the `Legal` catalog.
 */
async function LegalPage({ doc }: { doc: LegalDoc }) {
  const t = await getTranslations("Legal");
  const format = await getFormatter();
  const sections = t.raw(`${doc}.sections`) as LegalSection[];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-12 md:px-8 md:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t(`${doc}.title`)}</h1>
        <p className="text-sm text-muted-foreground">
          {t("updated", { date: format.dateTime(LAST_UPDATED, { dateStyle: "long" }) })}
        </p>
        <p className="leading-7 text-foreground/90">{t(`${doc}.intro`)}</p>
      </header>

      <nav aria-label={t("contents")} className="rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-semibold">{t("contents")}</h2>
        <ol className="mt-3 grid list-decimal gap-1.5 pl-5 text-sm text-muted-foreground sm:grid-cols-2">
          {sections.map((section, index) => (
            <li key={section.heading}>
              <a href={`#${anchor(index)}`} className="hover:text-foreground hover:underline">
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex flex-col gap-10">
        {sections.map((section, index) => (
          <section
            key={section.heading}
            id={anchor(index)}
            className="flex scroll-mt-24 flex-col gap-3"
          >
            <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
            {section.body?.map((paragraph) => (
              <p key={paragraph} className="leading-7 text-foreground/90">
                {paragraph}
              </p>
            ))}
            {section.items && (
              <ul className="flex list-disc flex-col gap-2 pl-6 leading-7 text-foreground/90">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.after?.map((paragraph) => (
              <p key={paragraph} className="leading-7 text-foreground/90">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

export { LegalPage };
