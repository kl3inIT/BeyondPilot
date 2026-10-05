import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { customProgramPages } from "@/features/program/custom-pages";
import { ProgramPage } from "@/features/program/program-page";
import { readProgram } from "@/features/program/program-public-queries";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/programs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const program = await readProgram(slug);

  return {
    title: `${program.name} · BeyondPilot`,
    description: program.summary ?? undefined,
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

  return Custom ? <Custom program={program} /> : <ProgramPage program={program} />;
}
