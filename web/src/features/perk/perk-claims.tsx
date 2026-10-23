"use client";

import { UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { ExportMenu } from "@/components/composites/export-menu";
import { Status } from "@/components/composites/status";
import { useNotify } from "@/hooks/use-notify";
import { useFormatter } from "@/i18n/format";
import { useRouter } from "@/i18n/navigation";
import {
  decideAdminPerkRequest,
  decideMyPerkRequest,
  exportAdminPerkClaims,
  exportMyPerkClaims,
  type Perk,
  type PerkClaimRow,
} from "@/lib/api/generated";

const tones = {
  taken: "success",
  granted: "success",
  waiting: "warning",
  declined: "destructive",
} as const;

/** Grants or declines one waiting request; the person who sent it is emailed. */
function Decide({ perk, claim, side }: { perk: Perk; claim: PerkClaimRow; side: "own" | "admin" }) {
  const t = useTranslations("Perk.manage.claims");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState<boolean | null>(null);

  async function decide(granted: boolean) {
    setPending(granted);
    try {
      await (side === "admin" ? decideAdminPerkRequest : decideMyPerkRequest)({
        path: { id: perk.id, claimId: claim.id },
        body: { granted, version: claim.version },
      });
      notify.success(
        granted ? "Perk.manage.claims.done.granted" : "Perk.manage.claims.done.declined",
        {
          name: claim.personName,
        },
      );
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(null);
    }
    // Someone else may have answered meanwhile: the list says what is true now.
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        prominence="secondary"
        pending={pending === false}
        disabled={pending !== null}
        onClick={() => decide(false)}
      >
        {t("decline")}
      </Button>
      <Button
        size="sm"
        pending={pending === true}
        disabled={pending !== null}
        onClick={() => decide(true)}
      >
        {t("grant")}
      </Button>
    </div>
  );
}

/**
 * Who got a perk, and the requests that wait: each team's person with their answers, the code they
 * got and when, with the waiting requests to grant or decline. The list is downloaded with every
 * answer in a column of its own.
 */
function PerkClaims({
  perk,
  claims,
  side,
}: {
  perk: Perk;
  claims: PerkClaimRow[];
  side: "own" | "admin";
}) {
  const t = useTranslations("Perk.manage.claims");
  const format = useFormatter();
  const labels = new Map(perk.questions.map((question) => [question.id, question.label]));
  const decides = perk.way === "request" && perk.requireApproval;

  return (
    <section aria-labelledby="perk-claims" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="perk-claims" className="text-lg font-semibold">
          {t("title")}{" "}
          <span className="font-normal text-muted-foreground">
            {t("count", { count: claims.length })}
          </span>
        </h2>
        <ExportMenu
          name="perk-claims"
          disabled={claims.length === 0}
          download={(format) =>
            (side === "admin" ? exportAdminPerkClaims : exportMyPerkClaims)({
              path: { id: perk.id },
              query: { format },
              parseAs: "blob",
            })
          }
        />
      </div>
      <DataTableRows
        columns={[
          { id: "person", header: t("columns.person"), layout: { fill: true } },
          { id: "organization", header: t("columns.organization"), layout: { width: "md" } },
          { id: "state", header: t("columns.state") },
          { id: "at", header: t("columns.at"), layout: { from: "lg" } },
          ...(decides
            ? [
                {
                  id: "actions",
                  header: <span className="sr-only">{t("columns.actions")}</span>,
                  layout: { width: "lg" as const },
                },
              ]
            : []),
        ]}
        rows={claims.map((claim) => ({
          id: claim.id,
          cells: {
            person: (
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-medium">{claim.personName}</span>
                <span className="truncate text-xs text-muted-foreground">{claim.personEmail}</span>
                {claim.code && <code className="font-mono text-xs break-all">{claim.code}</code>}
                {Object.keys(claim.answers).length > 0 && (
                  <dl className="flex flex-col gap-1 pt-1 text-xs">
                    {Object.entries(claim.answers).map(([id, answer]) => (
                      <div key={id}>
                        <dt className="text-muted-foreground">{labels.get(id) ?? id}</dt>
                        <dd className="whitespace-pre-line">{answer}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ),
            organization: <span className="block max-w-36 truncate">{claim.organizationName}</span>,
            state: (
              <Status tone={tones[claim.state]} appearance="pill">
                {t(`state.${claim.state}`)}
              </Status>
            ),
            at: format.dateTime(new Date(claim.createdAt), "date"),
            actions:
              claim.state === "waiting" ? <Decide perk={perk} claim={claim} side={side} /> : null,
          },
        }))}
        empty={
          claims.length > 0 ? null : (
            <DataTableEmpty icon={<UsersIcon aria-hidden="true" />} title={t("empty")} />
          )
        }
      />
    </section>
  );
}

export { PerkClaims };
