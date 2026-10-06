import { FileTextIcon, LinkIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { AttachedFile, SubmittedApplication } from "@/lib/api/generated";

type Row = [string, React.ReactNode];

/** The address a judge opens a file of the submission at; the backend checks they review it. */
function fileHref(applicationId: string, file: AttachedFile) {
  return `/api/proposal/review/applications/${applicationId}/files/${file.fileId}`;
}

/**
 * A link an applicant gave, when it is a web address. The backend takes only https links, but an
 * answer is shown as it was stored, so anything else is shown as text and never becomes a link.
 */
function webAddress(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function size(bytes: number) {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/**
 * An application as its applicant submitted it last, in the blocks of the form: who applies, the
 * solution, the program's questions and the files, which a reviewer opens.
 */
async function SubmittedRecord({
  applicationId,
  submitted,
}: {
  applicationId: string;
  submitted: SubmittedApplication;
}) {
  const [t, vocabulary, locale] = await Promise.all([
    getTranslations("Review.record"),
    getTranslations("Vocabulary"),
    getLocale(),
  ]);
  const none = t("notGiven");
  // The backend sends codes as plain strings; one this catalog does not know is shown as it came.
  const words = vocabulary as unknown as { (key: string): string; has: (key: string) => boolean };
  const word = (
    set: "organizationType" | "teamSize" | "maturity" | "country",
    code?: string | null,
  ) => (!code ? none : words.has(`${set}.${code}`) ? words(`${set}.${code}`) : code);
  const contact = submitted.contact;

  const files: {
    label: string;
    meta: string;
    file?: AttachedFile;
    link?: string;
    /** A link answer that is not a web address: shown, never opened. */
    text?: boolean;
  }[] = [];
  if (submitted.deck) {
    files.push({
      label: submitted.deck.fileName,
      meta: `${t("deck")} · ${size(submitted.deck.sizeBytes)}`,
      file: submitted.deck,
    });
  }
  for (const answer of submitted.answers) {
    if (answer.kind === "file" && answer.file) {
      files.push({
        label: answer.file.fileName,
        meta: `${answer.label} · ${size(answer.file.sizeBytes)}`,
        file: answer.file,
      });
    }
    if (answer.kind === "link") {
      const link = webAddress(answer.value);
      files.push(
        link
          ? { label: answer.label, meta: answer.value, link }
          : { label: answer.label, meta: answer.value, text: true },
      );
    }
  }

  const blocks: { key: string; title: string; rows: Row[] }[] = [
    {
      key: "team",
      title: t("blocks.team"),
      rows: [
        [
          t("applyingAs"),
          `${submitted.organizationName} · ${word("organizationType", submitted.organizationType)}`,
        ],
        [
          t("contact"),
          [
            [contact.firstName, contact.lastName].filter(Boolean).join(" "),
            submitted.email,
            contact.phone,
          ]
            .filter(Boolean)
            .join(" · "),
        ],
        [t("country"), word("country", submitted.country ?? contact.country)],
        ...(submitted.teamSize
          ? [[t("teamSize"), word("teamSize", submitted.teamSize)] as Row]
          : []),
        ...(contact.linkedin ? [[t("linkedin"), contact.linkedin] as Row] : []),
        ...(submitted.website ? [[t("website"), submitted.website] as Row] : []),
        ...(submitted.teamBackground
          ? [[t("teamBackground"), submitted.teamBackground] as Row]
          : []),
      ],
    },
    {
      key: "solution",
      title: t("blocks.solution"),
      rows: [
        [t("solution"), submitted.solutionName],
        [t("summary"), submitted.summary ?? none],
        [t("problemsSolved"), submitted.problemsSolved ?? none],
        [t("maturity"), word("maturity", submitted.maturity)],
        [t("builtWith"), submitted.builtWith.join(", ") || none],
        [t("traction"), submitted.traction ?? none],
      ],
    },
  ];
  const answered = submitted.answers.filter(
    (answer) => answer.kind !== "file" && answer.kind !== "link",
  );
  if (answered.length > 0) {
    blocks.push({
      key: "questions",
      title: t("blocks.questions"),
      rows: answered.map((answer): Row => [
        answer.label,
        answer.kind === "confirm" ? t("confirmed") : answer.value,
      ]),
    });
  }

  return (
    <div className="flex flex-col gap-4" lang={locale}>
      {blocks.map((block) => (
        <section
          key={block.key}
          aria-labelledby={`record-${block.key}`}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-5"
        >
          <h2 id={`record-${block.key}`} className="font-medium">
            {block.title}
          </h2>
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
      {files.length > 0 && (
        <section
          aria-labelledby="record-files"
          className="flex flex-col gap-2 rounded-xl border bg-card p-4 md:p-5"
        >
          <h2 id="record-files" className="font-medium">
            {t("blocks.files")}
          </h2>
          <ul className="flex flex-col divide-y">
            {files.map((item) => (
              <li
                key={`${item.label}-${item.meta}`}
                className="flex items-center gap-3 py-2.5 text-sm"
              >
                {item.link || item.text ? (
                  <LinkIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileTextIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{item.label}</span>
                  <span className="truncate text-muted-foreground">{item.meta}</span>
                </span>
                {!item.text && (
                  <a
                    href={item.link ?? fileHref(applicationId, item.file as AttachedFile)}
                    target={item.link ? "_blank" : undefined}
                    rel={item.link ? "noreferrer" : undefined}
                    className="shrink-0 font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:underline"
                  >
                    {item.link ? t("openLink") : t("open")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export { SubmittedRecord };
