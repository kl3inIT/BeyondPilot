"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { FormDialog } from "@/components/composites/form-dialog";
import { ReviewStatus } from "@/components/composites/review-status";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { FieldGroup } from "@/components/ui/field";
import { useNotify } from "@/hooks/use-notify";
import { useVocabulary } from "@/i18n/vocabulary";
import {
  addCustomerDeployment,
  deleteCustomerDeployment,
  restoreCustomerDeployment,
  saveCustomerDeployment,
  withdrawCustomerDeployment,
  type CustomerDeployment,
  type SaveCustomerDeployment,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";

import { deploymentStages } from "./solution-codes";
import { solutionError } from "./solution-errors";

/** The most customer deployments one solution lists; the backend refuses more. */
const MAX_DEPLOYMENTS = 12;

const optionalFields = ["channels", "languages", "period", "result"] as const;

/** What the form holds for a deployment, or for a new one. */
function held(deployment: CustomerDeployment | null) {
  return {
    title: deployment?.title ?? "",
    customer: deployment?.customer ?? "",
    problem: deployment?.problem ?? "",
    delivered: deployment?.delivered ?? "",
    stage: (deployment?.stage ?? "production") as string,
    channels: deployment?.channels ?? "",
    languages: deployment?.languages ?? "",
    period: deployment?.period ?? "",
    result: deployment?.result ?? "",
  };
}

type DeploymentFormProps = {
  solutionId: string;
  /** The deployment to change, or `null` for a new one. */
  deployment: CustomerDeployment | null;
  onClose: () => void;
};

/** The form of one customer deployment, in a dialog. Saving sends it to GenAI Fund for review. */
function DeploymentForm({ solutionId, deployment, onClose }: DeploymentFormProps) {
  const t = useTranslations("Solution.deployments.form");
  const stage = useVocabulary("deploymentStage");
  const notify = useNotify();
  const router = useRouter();
  const say = useTranslations("Form.errors");
  // What the form must hold is what the browser asked for before: something, even a space.
  const filled = z.string().min(1, say("required"));
  const form = useAppForm({
    defaultValues: held(deployment),
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        title: filled,
        customer: filled,
        problem: filled,
        delivered: filled,
        stage: z.string(),
        channels: z.string(),
        languages: z.string(),
        period: z.string(),
        result: z.string(),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      const body: SaveCustomerDeployment = {
        title: value.title,
        customer: value.customer,
        problem: value.problem,
        delivered: value.delivered,
        stage: value.stage as SaveCustomerDeployment["stage"],
        channels: value.channels.trim() || null,
        languages: value.languages.trim() || null,
        period: value.period.trim() || null,
        result: value.result.trim() || null,
        version: deployment?.version ?? null,
      };
      try {
        await (deployment
          ? saveCustomerDeployment({ path: { solutionId, id: deployment.id }, body })
          : addCustomerDeployment({ path: { solutionId }, body }));
        notify.success("Solution.done.deploymentSaved", { name: value.title.trim() });
        router.refresh();
        onClose();
      } catch (error) {
        // The fields the backend rejected are marked; why is said in the toast, as before.
        setServerErrors(formApi, {
          fields: Object.fromEntries(
            [...rejectedFields(error)]
              .filter((field) => field in value)
              .map((field) => [field, { message: say("invalid") }]),
          ),
        });
        notify.error(solutionError(error));
      }
    },
  });

  return (
    <FormDialog
      open
      onOpenChange={(next) => !next && onClose()}
      form={form}
      title={t(deployment ? "editTitle" : "addTitle")}
      description={t("lead")}
      width="3xl"
      submitLabel={t("save")}
      cancelLabel={t("cancel")}
    >
      <FieldGroup>
        <form.AppField name="title">
          {(field) => (
            <field.TextField
              label={t("title")}
              required
              maxLength={120}
              description={t("titleHint")}
            />
          )}
        </form.AppField>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.AppField name="customer">
            {(field) => (
              <field.TextField
                label={t("customer")}
                required
                maxLength={120}
                description={t("customerHint")}
              />
            )}
          </form.AppField>
          <form.AppField name="stage">
            {(field) => (
              <field.SelectField
                label={t("stage")}
                options={deploymentStages.map((value) => ({ value, label: stage(value) }))}
              />
            )}
          </form.AppField>
        </div>
        <form.AppField name="problem">
          {(field) => (
            <field.TextareaField label={t("problem")} required rows={3} maxLength={1000} />
          )}
        </form.AppField>
        <form.AppField name="delivered">
          {(field) => (
            <field.TextareaField label={t("delivered")} required rows={3} maxLength={1000} />
          )}
        </form.AppField>
        <div className="grid gap-4 sm:grid-cols-2">
          {optionalFields.map((name) => (
            <form.AppField key={name} name={name}>
              {(field) => (
                <field.TextField
                  label={t(name)}
                  maxLength={name === "result" ? 300 : 120}
                  description={name === "languages" ? undefined : t(`${name}Hint`)}
                />
              )}
            </form.AppField>
          ))}
        </div>
      </FieldGroup>
    </FormDialog>
  );
}

type CustomerDeploymentsEditorProps = {
  solutionId: string;
  /** True while the solution was never sent for review: nobody else read its deployments. */
  draft: boolean;
  deployments: CustomerDeployment[];
};

/**
 * The customer deployments of a solution as its owners keep them: each with where its review
 * stands, and a form to add or change one. A change sends the deployment to review again.
 * Removing one from a solution that was sent for review withdraws it: it runs at once, nobody is
 * told, and the toast offers Undo; the deployment stays in the list, where it is restored later.
 * On a draft nobody else read it, so it is really deleted, and that is asked once.
 */
function CustomerDeploymentsEditor({
  solutionId,
  draft,
  deployments,
}: CustomerDeploymentsEditorProps) {
  const t = useTranslations("Solution.deployments");
  const status = useVocabulary("reviewStatus");
  const reason = useVocabulary("deploymentRejection");
  const stage = useVocabulary("deploymentStage");
  const notify = useNotify();
  const router = useRouter();
  // `null` is the form for a new deployment; `undefined` is no form.
  const [editing, setEditing] = useState<CustomerDeployment | null | undefined>(undefined);
  const [removing, setRemoving] = useState<CustomerDeployment | null>(null);
  const [pending, setPending] = useState(false);
  // A withdrawn deployment does not take one of the places.
  const listed = deployments.filter((deployment) => !deployment.withdrawnAt).length;

  async function remove(deployment: CustomerDeployment) {
    setPending(true);
    try {
      await deleteCustomerDeployment({ path: { solutionId, id: deployment.id } });
      notify.success("Solution.done.deploymentRemoved", { name: deployment.title });
      router.refresh();
      setRemoving(null);
    } catch (error) {
      notify.error(solutionError(error));
    } finally {
      setPending(false);
    }
  }

  async function withdraw(deployment: CustomerDeployment) {
    setPending(true);
    try {
      await withdrawCustomerDeployment({ path: { solutionId, id: deployment.id } });
      notify.success(
        "Solution.done.deploymentRemoved",
        { name: deployment.title },
        { undo: () => void restore(deployment) },
      );
      router.refresh();
    } catch (error) {
      notify.error(solutionError(error));
    } finally {
      setPending(false);
    }
  }

  async function restore(deployment: CustomerDeployment) {
    setPending(true);
    try {
      await restoreCustomerDeployment({ path: { solutionId, id: deployment.id } });
      notify.success("Solution.done.deploymentRestored", { name: deployment.title });
      router.refresh();
    } catch (error) {
      notify.error(solutionError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        {listed < MAX_DEPLOYMENTS ? (
          <Button prominence="secondary" size="sm" onClick={() => setEditing(null)}>
            <PlusIcon aria-hidden="true" />
            {t("add")}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("limitReached", { max: MAX_DEPLOYMENTS })}
          </p>
        )}
      </div>
      {deployments.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted p-4 text-sm text-muted-foreground">
          {t("none")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {deployments.map((deployment) => (
            <li
              key={deployment.id}
              className="flex flex-col gap-2 rounded-xl border bg-background p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <h3 className="text-base font-medium">{deployment.title}</h3>
                <ReviewStatus state={deployment.status}>{status(deployment.status)}</ReviewStatus>
              </div>
              <p className="text-sm text-muted-foreground">
                {deployment.customer} · {stage(deployment.stage)}
              </p>
              {deployment.status === "rejected" && (
                <p className="text-sm text-destructive">
                  {t("rejected", { reason: reason(deployment.decisionReason ?? "other") })}
                  {deployment.decisionMessage && <> {deployment.decisionMessage}</>}
                </p>
              )}
              {deployment.withdrawnAt ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("withdrawn")}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      prominence="secondary"
                      size="sm"
                      disabled={pending || listed >= MAX_DEPLOYMENTS}
                      onClick={() => void restore(deployment)}
                    >
                      {t("restore")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button prominence="secondary" size="sm" onClick={() => setEditing(deployment)}>
                    {t("edit")}
                  </Button>
                  <Button
                    prominence="tertiary"
                    tone="danger"
                    size="sm"
                    disabled={pending}
                    onClick={() => (draft ? setRemoving(deployment) : void withdraw(deployment))}
                  >
                    {t("remove")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing !== undefined && (
        <DeploymentForm
          solutionId={solutionId}
          deployment={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(next) => (next ? undefined : setRemoving(null))}
          title={t("confirmRemove.title", { name: removing.title })}
          description={t("confirmRemove.lead")}
          confirmLabel={t("remove")}
          cancelLabel={t("form.cancel")}
          tone="danger"
          pending={pending}
          onConfirm={() => remove(removing)}
        />
      )}
    </section>
  );
}

export { CustomerDeploymentsEditor };
