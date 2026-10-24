import { useLocale, useTranslations } from "next-intl";

import { ReviewStatus } from "@/components/composites/review-status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Link } from "@/i18n/navigation";
import type { AdminUseCase, MyUseCase, UseCaseAccess, UseCasePreview } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { UseCaseAccessPanel } from "./use-case-access-panel";
import { UseCasePreviewLink } from "./use-case-preview-link";
import { UseCaseTabs } from "./use-case-tabs";

/**
 * Member access, as the organization reads it: who may open one of its use cases and what they may do with
 * it. The people with full access change it; everyone else reads the list.
 */
function WorkspaceUseCaseAccessPage({
  useCase,
  access,
  preview,
}: {
  useCase: MyUseCase;
  access: UseCaseAccess;
  /** The read-only link, for those who have full access to a use case that is not public. */
  preview: UseCasePreview | null;
}) {
  const t = useTranslations("Organization.useCases.access");
  const w = useTranslations("Organization.useCases.wizard");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 pt-8 pb-24 md:px-8">
      <div className="flex flex-col gap-2">
        <Link
          href={siteRoutes.workspaceUseCases}
          className="w-fit rounded-sm text-sm text-muted-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("back")}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {useCase.title ?? w("untitled")}
        </h1>
        <p className="text-sm text-muted-foreground">{useCase.organizationName}</p>
      </div>
      <UseCaseTabs
        area="workspace"
        id={useCase.id}
        current="access"
        published={Boolean(useCase.publishedAt)}
      />
      {preview && <UseCasePreviewLink area="workspace" id={useCase.id} preview={preview} />}
      <UseCaseAccessPanel area="workspace" id={useCase.id} access={access} />
    </div>
  );
}

/** The same for operators, who may change it for any use case. */
function AdminUseCaseAccessPage({
  useCase,
  access,
  preview,
  proposals,
}: {
  useCase: AdminUseCase;
  access: UseCaseAccess;
  /** The read-only link, for a use case that is not public. */
  preview: UseCasePreview | null;
  /** How many proposals the use case received, for its tab. */
  proposals?: number;
}) {
  const t = useTranslations("Admin.useCases.detail");
  const statusLabel = useTranslations("Admin.useCases.status");
  const locale = useLocale();

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        title={useCase.title ?? t("untitled")}
        badges={
          <ReviewStatus appearance="pill" state={useCase.status}>
            {statusLabel(useCase.status)}
          </ReviewStatus>
        }
        lead={useCase.organization.name}
      >
        <UseCaseTabs
          area="admin"
          id={useCase.id}
          current="access"
          proposals={proposals}
          published={Boolean(useCase.publishedAt)}
        />
      </AdminPageHeader>
      <div className="flex max-w-4xl flex-col gap-6">
        {preview && <UseCasePreviewLink area="admin" id={useCase.id} preview={preview} />}
        <UseCaseAccessPanel area="admin" id={useCase.id} access={access} />
      </div>
    </div>
  );
}

export { AdminUseCaseAccessPage, WorkspaceUseCaseAccessPage };
