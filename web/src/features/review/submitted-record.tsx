import { getLocale, getTranslations } from "next-intl/server";

import type { AttachedFile, SubmittedApplication } from "@/lib/api/generated";
import { chosenOptions } from "@/lib/chosen-options";

import { linkedinAddress, mailAddress, phoneAddress, webAddress } from "./applicant-links";
import { RecordFiles, type RecordFile } from "./record-files";

type Row = [string, React.ReactNode];

/**
 * The address a file of the record opens at: a judge's of a submission, an operator's of a draft.
 * The backend checks who may open it and records the opening.
 */
function fileHref(applicationId: string, file: AttachedFile, draft: boolean) {
  return `/api/proposal/review/${draft ? "drafts" : "applications"}/${applicationId}/files/${file.fileId}`;
}

/** A link of the record, 24px to aim at: the padding adds 4px to its line and the margin takes it back. */
const link =
  "-my-0.5 inline-flex py-0.5 font-medium text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

/** A web address the applicant gave, opened in a tab of its own, away from the review. */
function Outside({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
      {children}
    </a>
  );
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
  draft = false,
}: {
  applicationId: string;
  submitted: SubmittedApplication;
  /** A draft not submitted yet, read by an operator: its files open at the draft's address. */
  draft?: boolean;
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
  // A judge reads no contact details: the backend sends none, and the rows are left out.
  const contact = submitted.contact ?? null;
  const demo = submitted.demoUrl ? webAddress(submitted.demoUrl) : null;
  const contactRows: Row[] = [];
  if (contact) {
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
    // What the applicant typed is a link only where it leads to what its row says; otherwise text.
    const mail = submitted.email ? mailAddress(submitted.email) : null;
    const email = mail ? (
      <a href={mail} className={link}>
        {submitted.email}
      </a>
    ) : (
      (submitted.email ?? none)
    );
    const dial = contact.phone ? phoneAddress(contact.phone) : null;
    const phone = dial ? (
      <a href={dial} className={link}>
        {contact.phone}
      </a>
    ) : (
      (contact.phone ?? none)
    );
    const linkedin = contact.linkedin ? linkedinAddress(contact.linkedin) : null;
    // One row each: the email and the phone are copied from here to reach the applicant.
    contactRows.push([t("name"), name || none], [t("email"), email], [t("phone"), phone]);
    if (contact.linkedin) {
      contactRows.push([
        t("linkedin"),
        linkedin ? <Outside href={linkedin}>{contact.linkedin}</Outside> : contact.linkedin,
      ]);
    }
  }
  const website = submitted.website ? webAddress(submitted.website) : null;

  const files: RecordFile[] = [];
  if (submitted.deck) {
    files.push({
      kind: "file",
      label: submitted.deck.fileName,
      meta: `${t("deck")} · ${size(submitted.deck.sizeBytes)}`,
      href: fileHref(applicationId, submitted.deck, draft),
    });
  }
  for (const answer of submitted.answers) {
    if (answer.kind === "file" && answer.file) {
      files.push({
        kind: "file",
        label: answer.file.fileName,
        meta: `${answer.label} · ${size(answer.file.sizeBytes)}`,
        href: fileHref(applicationId, answer.file, draft),
      });
    }
    if (answer.kind === "link") {
      const link = webAddress(answer.value);
      files.push(
        link
          ? { kind: "link", label: answer.label, meta: answer.value, href: link }
          : { kind: "text", label: answer.label, meta: answer.value },
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
        ...contactRows,
        [t("country"), word("country", submitted.country ?? contact?.country)],
        ...(submitted.teamSize
          ? [[t("teamSize"), word("teamSize", submitted.teamSize)] as Row]
          : []),
        ...(submitted.website
          ? [
              [
                t("website"),
                website ? <Outside href={website}>{submitted.website}</Outside> : submitted.website,
              ] as Row,
            ]
          : []),
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
        ...(submitted.demoUrl
          ? [
              [
                t("demoUrl"),
                demo ? <Outside href={demo}>{submitted.demoUrl}</Outside> : submitted.demoUrl,
              ] as Row,
            ]
          : []),
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
        answer.kind === "confirm"
          ? t("confirmed")
          : answer.kind === "multi_choice"
            ? // One choice a line: a choice may hold a comma of its own.
              chosenOptions(answer.value).join("\n") || none
            : answer.value,
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
          <RecordFiles
            items={files}
            labels={{ open: t("open"), openLink: t("openLink") }}
            linkClassName={link}
          />
        </section>
      )}
    </div>
  );
}

export { SubmittedRecord };
