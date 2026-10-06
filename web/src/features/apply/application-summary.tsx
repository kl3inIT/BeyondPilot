import { getLocale, getTranslations } from "next-intl/server";

import type { ApplicationView } from "@/lib/api/generated";

/** Rows of a summary block: what each part of the application holds, as the applicant reads it. */
type Block = { key: "you" | "solution" | "questions"; rows: [string, string][] };

/**
 * An application as submitted or saved, in the blocks of the form: who applies, the solution and
 * the program's own questions. Files are named, never linked: the applicant has them already.
 */
async function ApplicationSummary({ view }: { view: ApplicationView }) {
  const [t, you, solutionText, vocabulary, locale] = await Promise.all([
    getTranslations("Apply.review"),
    getTranslations("Apply.you"),
    getTranslations("Apply.solution"),
    getTranslations("Vocabulary"),
    getLocale(),
  ]);
  const application = view.application;
  if (!application) {
    return null;
  }
  const none = t("notAdded");
  // The backend sends codes as plain strings; one this catalog does not know is shown as it came.
  const words = vocabulary as unknown as { (key: string): string; has: (key: string) => boolean };
  const word = (set: "organizationType" | "teamSize" | "maturity" | "country", code: string) =>
    words.has(`${set}.${code}`) ? words(`${set}.${code}`) : code;
  const contact = application.contact;
  const organization = view.organization;
  const solution = view.solutions.find((option) => option.id === application.solutionId);

  const blocks: Block[] = [
    {
      key: "you",
      rows: [
        [
          t("applyingAs"),
          organization
            ? `${organization.name} · ${word("organizationType", organization.type)}`
            : none,
        ],
        [t("name"), [contact.firstName, contact.lastName].filter(Boolean).join(" ") || none],
        [you("email"), view.email],
        [you("phone"), contact.phone ?? none],
        [you("country"), contact.country ? word("country", contact.country) : none],
        [you("linkedin"), contact.linkedin ?? none],
        ...(application.teamBackground
          ? [[you("teamBackground"), application.teamBackground] as [string, string]]
          : []),
      ],
    },
    {
      key: "solution",
      rows: [
        [t("solution"), solution?.name ?? none],
        [solutionText("summary"), solution?.summary ?? none],
        [solutionText("problemsSolved"), solution?.problemsSolved ?? none],
        [t("maturity"), solution?.maturity ? word("maturity", solution.maturity) : none],
        [t("traction"), application.traction ?? none],
        [t("builtWith"), application.builtWith.join(", ") || none],
        [t("deck"), application.deck?.fileName ?? none],
      ],
    },
  ];
  if (view.program.questions.length > 0) {
    blocks.push({
      key: "questions",
      rows: view.program.questions.map((question): [string, string] => {
        const value = application.answers[question.id];
        if (!value) {
          return [question.label, none];
        }
        if (question.kind === "confirm") {
          return [question.label, t("confirmed")];
        }
        if (question.kind === "file") {
          return [question.label, application.files[question.id]?.fileName ?? t("uploaded")];
        }
        return [question.label, value];
      }),
    });
  }

  return (
    <div className="flex flex-col gap-4" lang={locale}>
      {blocks.map((block) => (
        <section
          key={block.key}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-5"
        >
          <h2 className="font-medium">{t(`blocks.${block.key}`)}</h2>
          <dl className="flex flex-col gap-2.5">
            {block.rows.map(([label, value]) => (
              <div key={label} className="grid gap-1 text-sm sm:grid-cols-3 sm:gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words whitespace-pre-line sm:col-span-2">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export { ApplicationSummary };
