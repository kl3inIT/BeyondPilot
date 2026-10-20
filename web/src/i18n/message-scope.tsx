import { NextIntlClientProvider, type Messages } from "next-intl";
import { getMessages } from "next-intl/server";

/** Dotted catalog paths down to four levels, such as `Site` or `Admin.useCases.form`. */
type Path<T, Depth extends unknown[] = []> = Depth["length"] extends 4
  ? never
  : T extends string
    ? never
    : {
        [K in keyof T & string]: T[K] extends string ? K : K | `${K}.${Path<T[K], [...Depth, 0]>}`;
      }[keyof T & string];

type MessagePath = Path<Messages>;

/**
 * The parts of the catalog that client components read, by area. A namespace missing here fails in
 * the browser with MISSING_MESSAGE, so a client component that reads a new one adds it to its area.
 * Server Components read the whole catalog and need nothing from this list.
 */
const rootPaths = [
  // The header, footer, toasts, the error screen and the words for a failed request, on every page.
  "Site",
  "Error",
  "Errors",
  "Actions",
  // Shared controls: form fields, list paging and sorting, and the words for a code.
  "Form",
  "Lists",
  "Vocabulary",
  "Campaign",
] as const satisfies readonly MessagePath[];

const areaPaths = {
  public: [
    "Account",
    "Application",
    "Home.featured",
    "Mcp",
    "Program",
    "Programs",
    "Solution",
    "Talent",
    "UseCases",
    // Taking back a proposal, on the page that reads it; the rest of the proposal belongs to the apply area.
    "UseCaseProposal.view.withdraw",
    // The full-screen reader of the proposal the organization sent.
    "PdfViewer",
    "UseCaseProposal.errors",
  ],
  auth: ["SignIn"],
  apply: [
    "Apply",
    "EntryList",
    "Organization",
    "PdfUpload",
    // The full-screen reader of the deck and of the use case files.
    "PdfViewer",
    "Solution",
    "Talent",
    "UseCaseProposal",
    // The use-case form shared with the operators; the rest of Admin stays out.
    "Admin.useCases.form.attachments",
  ],
  workspace: [
    "EntryList",
    "Matching",
    "Messaging",
    "Organization",
    "PdfViewer",
    "Solution",
    "Talent",
    "UseCaseProposal",
    "Admin.useCases.form.attachments",
  ],
  admin: [
    "Admin",
    "EntryList",
    // The Export menu of the lists operators download.
    "ExportMenu",
    "Matching",
    "Messaging.assignments",
    "Mcp",
    "Organization",
    // The full-screen reader of an application's files.
    "PdfViewer",
    "Program",
    "Review",
    "Solution",
    "Talent",
    // Deciding on the proposals of a use case, which the operators read as well.
    "UseCaseProposal.received",
    "UseCaseProposal.errors",
  ],
  reviews: ["ExportMenu", "PdfViewer", "Review"],
} as const satisfies Record<string, readonly MessagePath[]>;

type Area = keyof typeof areaPaths;

/**
 * The modules whose requests only an operator's screens make. The words for their failure codes are
 * a quarter of `Errors` and go to the admin area alone; elsewhere such a code gets the general words.
 */
const operatorCodes = /^(AI|SEARCH|NOTIFICATION|PROGRAM)_/;

/** The given paths of the catalog; a path under a path that is also given is already included. */
function pick(messages: Record<string, unknown>, paths: readonly string[]) {
  const wanted = new Set(paths);
  const result: Record<string, unknown> = {};

  for (const path of wanted) {
    const keys = path.split(".");
    const covered = keys.slice(0, -1).some((_, i) => wanted.has(keys.slice(0, i + 1).join(".")));
    if (covered) continue;

    const last = keys.pop() as string;
    let from = messages;
    let into = result;
    for (const key of keys) {
      from = from[key] as Record<string, unknown>;
      into = (into[key] ??= {}) as Record<string, unknown>;
    }
    into[last] = from[last];
  }
  return result;
}

/**
 * Hands the browser the messages of one area instead of the whole catalog, which is most of what a
 * page weighs. A nested provider replaces the one above it, so each area lists the shared paths again.
 */
async function MessageScope({ area, children }: { area?: Area; children: React.ReactNode }) {
  const paths: readonly string[] = [...rootPaths, ...(area ? areaPaths[area] : [])];
  const messages = pick(await getMessages(), paths);
  if (area !== "admin") {
    messages.Errors = Object.fromEntries(
      Object.entries(messages.Errors as Record<string, string>).filter(
        ([code]) => !operatorCodes.test(code),
      ),
    );
  }

  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}

export { MessageScope };
