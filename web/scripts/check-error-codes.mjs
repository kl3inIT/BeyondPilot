// Fails when a failure code of the backend has no words in the catalogs and is not listed here as
// deliberately general, and when the catalogs word a code the backend no longer has
// (docs/conventions.md › API errors).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * The codes no screen can be refused with, each with why. A request that fails with one of them is
 * said in the general words. A code a person can meet is never added here: it gets words.
 */
export const general = {
  IDENTITY_EMAIL_NOT_VERIFIED:
    "Raised in the Google round trip, which ends in a redirect to the sign-in screen, never in a problem the web reads.",
  NOTIFICATION_EVENT_REFUSED:
    "Answers the email provider's delivery report, which no person sends.",
  NOTIFICATION_SUBSCRIPTION_NOT_CONFIRMED:
    "Answers Amazon SNS when it asks to confirm a subscription.",
  NOTIFICATION_REPORT_NOT_TAKEN:
    "Answers the email provider's delivery report when too many arrive.",
  PROGRAM_LUMA_EVENT_NOT_FOUND:
    "Raised only by the operators' MCP tools create_event and update_event, which say it in the tool's answer.",
  PROGRAM_LUMA_EVENT_REFUSED:
    "Raised only by the operators' MCP tools create_event and update_event, which say Luma's refusal in the tool's answer.",
  USECASE_NOT_PRIVATE:
    "Raised only by the operators' MCP tools that change a private use case, which say it in the tool's answer.",
};

/** Codes the backend's exception handler raises itself, outside the modules' enums. */
const handlerCodes = ["REQUEST_INVALID"];

/** The wire codes an `*ErrorCode.java` enum declares: the first argument of each constant. */
export function codesOf(source) {
  return [...source.matchAll(/^\s*[A-Z_0-9]+\(\s*"([A-Z_0-9]+)",\s*ErrorCategory\b/gm)].map(
    (match) => match[1],
  );
}

/**
 * What is wrong between the backend's codes, the codes one catalog words and the general list; empty
 * when every code is either worded or listed, and nothing is worded or listed that is not a code.
 */
export function problemsOf({ codes, worded, listed, catalog }) {
  const known = new Set(codes);
  const words = new Set(worded);
  const problems = [];
  for (const code of codes) {
    if (!words.has(code) && !listed.includes(code)) {
      problems.push(
        `${code} has no words: add Errors.${code} to ${catalog}, or list it in scripts/check-error-codes.mjs with the reason no screen meets it`,
      );
    }
    if (words.has(code) && listed.includes(code)) {
      problems.push(`${code} has words in ${catalog} and is also listed as general: keep one`);
    }
  }
  for (const code of worded) {
    if (!known.has(code)) {
      problems.push(`${catalog} words Errors.${code}, which the backend does not raise`);
    }
  }
  for (const code of listed) {
    if (!known.has(code)) {
      problems.push(`${code} is listed as general, and the backend does not raise it`);
    }
  }
  return problems;
}

function javaFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return javaFiles(path);
    return entry.name.endsWith("ErrorCode.java") ? [path] : [];
  });
}

function main() {
  const backend = fileURLToPath(
    new URL("../../backend/src/main/java/ai/genaifund/beyondpilot", import.meta.url),
  );
  const codes = [
    ...handlerCodes,
    ...javaFiles(backend).flatMap((path) => codesOf(readFileSync(path, "utf8"))),
  ];
  if (codes.length === handlerCodes.length) {
    console.error(`No failure code found under ${backend}; the check read nothing.`);
    process.exit(1);
  }
  const problems = ["en", "vi"].flatMap((locale) => {
    const catalog = `messages/${locale}.json`;
    const messages = JSON.parse(readFileSync(new URL(`../${catalog}`, import.meta.url), "utf8"));
    const worded = Object.keys(messages.Errors ?? {}).filter((key) => key !== "unknown");
    return problemsOf({ codes, worded, listed: Object.keys(general), catalog });
  });
  if (problems.length > 0) {
    for (const problem of new Set(problems)) console.error(problem);
    process.exit(1);
  }
  console.log(
    `Failure codes are covered (${codes.length} codes, ${Object.keys(general).length} deliberately general).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
