"use client";

import { useTranslations } from "next-intl";

import { AdminPageHeader } from "@/components/layout/admin-page-header";
import type { EvaluationCandidateDetail } from "@/lib/api/generated";
import { adminProgramEvaluationsRoute } from "@/lib/site";

import { useEvaluationDecide } from "./evaluation-decide";
import { EvaluationPanel } from "./evaluation-panel";
import { keyOf } from "./evaluation-view";

type EvaluationCandidatePageProps = {
  programId: string;
  detail: EvaluationCandidateDetail;
  released: boolean;
};

/** One candidate of a program's evaluation on a page of its own, with its earlier assessments. */
function EvaluationCandidatePage({ programId, detail, released }: EvaluationCandidatePageProps) {
  const t = useTranslations("Matching.evaluation");
  const { decide, pending } = useEvaluationDecide(programId);
  const { candidate } = detail;

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageHeader
        title={candidate.organizationName}
        lead={candidate.solutionName}
        back={{ href: adminProgramEvaluationsRoute(programId), label: t("page.back") }}
      />
      <div className="max-w-3xl">
        <EvaluationPanel
          candidate={candidate}
          programId={programId}
          released={released}
          pending={pending === keyOf(candidate)}
          onDecide={(verdict) => void decide(candidate, verdict)}
          earlier={detail.earlier}
          standalone
        />
      </div>
    </div>
  );
}

export { EvaluationCandidatePage };
