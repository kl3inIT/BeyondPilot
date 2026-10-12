import { useTranslations } from "next-intl";

import { DirectoryGridSkeleton } from "@/components/composites/directory-skeleton";

// Only the list is in this group: a solution's own page answers not-found, which a skeleton above
// it would turn into a streamed 200.
export default function SolutionsLoading() {
  const t = useTranslations("Solution.directory");

  return <DirectoryGridSkeleton title={t("title")} lead={t("lead")} filters={4} media />;
}
