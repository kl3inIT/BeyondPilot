import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { contactRoute } from "@/features/messaging/messaging-search";
import { customProgramPages, customProgramShareImages } from "@/features/program/custom-pages";
import { ProgramPage } from "@/features/program/program-page";
import { readProgram } from "@/features/program/program-public-queries";
import { getCurrentAccount } from "@/lib/auth/session";
import { publicFileUrl } from "@/lib/storage/upload";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/programs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const program = await readProgram(slug);
  // A shared link previews with the program's own picture: the one made for its written page when
  // that page is shown, else its cover. Without either it keeps the site's.
  const pageImage =
    program.pageKind === "custom" ? customProgramShareImages[program.slug] : undefined;
  const image = pageImage ?? (program.coverFileId ? publicFileUrl(program.coverFileId) : undefined);

  return {
    title: `${program.name} · BeyondPilot`,
    description: program.summary ?? undefined,
    // A key set to undefined still replaces the layout's, so it is left out instead.
    ...(image && { openGraph: { images: [{ url: image, alt: program.name }] } }),
    // A draft is seen by operators only, and never indexed.
    robots: program.status === "draft" ? { index: false } : undefined,
  };
}

export default async function ProgramRoute({ params }: PageProps<"/[locale]/programs/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const program = await readProgram(slug);
  if (program.pageKind === "external" && program.externalUrl && program.status === "published") {
    redirect(program.externalUrl);
  }
  // A program marked as made for its page falls back to the standard page until that page exists.
  const Custom = program.pageKind === "custom" ? customProgramPages[program.slug] : undefined;

  // "Ask GenAI Fund" leads to Messages; a visitor signs in first and comes back to the first
  // message. A draft is not written about, and an operator is the one who would answer.
  const account = await getCurrentAccount();
  const askHref =
    program.status === "published" && account?.role !== "operator"
      ? contactRoute({ kind: "program", slug: program.slug }, !!account, locale)
      : undefined;

  return Custom ? (
    <Custom program={program} askHref={askHref} />
  ) : (
    <ProgramPage program={program} askHref={askHref} />
  );
}
