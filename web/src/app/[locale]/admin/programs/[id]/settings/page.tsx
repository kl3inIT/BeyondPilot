import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProgramSettings } from "@/features/program/program-settings";
import { readAdminProgram } from "@/features/program/program-queries";
import { ProgramTabs } from "@/features/program/program-tabs";
import { requireRole } from "@/lib/auth/session";
import { adminProgramRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/settings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.programs.settings" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProgramSettingsRoute({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/settings">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminProgramRoute(id));
  const program = await readAdminProgram(id);

  // Settings starts from the program as it was read; a save reads it again.
  return (
    <ProgramSettings
      key={program.version}
      program={program}
      tabs={<ProgramTabs id={id} current="settings" applications={Boolean(program.applications)} />}
    />
  );
}
