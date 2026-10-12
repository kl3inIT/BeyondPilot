import { useTranslations } from "next-intl";

import { DirectoryGridSkeleton } from "@/components/composites/directory-skeleton";

// Only the list is in this group: a person's own page answers not-found, which a skeleton above it
// would turn into a streamed 200.
export default function TalentLoading() {
  const t = useTranslations("Talent.directory");

  return <DirectoryGridSkeleton title={t("title")} lead={t("lead")} filters={2} />;
}
