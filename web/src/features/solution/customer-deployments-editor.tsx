"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { ReviewStatus } from "@/components/composites/review-status";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { useVocabulary } from "@/i18n/vocabulary";
import {
  addCustomerDeployment,
  deleteCustomerDeployment,
  saveCustomerDeployment,
  type CustomerDeployment,
  type SaveCustomerDeployment,
} from "@/lib/api/generated";

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
    stage: deployment?.stage ?? "production",
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
  const id = useId();
  const [text, setText] = useState(held(deployment));
  const [pending, setPending] = useState(false);
  const write =
    (field: keyof typeof text) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setText((current) => ({ ...current, [field]: event.target.value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const body: SaveCustomerDeployment = {
      title: text.title,
      customer: text.customer,
      problem: text.problem,
      delivered: text.delivered,
      stage: text.stage as SaveCustomerDeployment["stage"],
      channels: text.channels.trim() || null,
      languages: text.languages.trim() || null,
      period: text.period.trim() || null,
      result: text.result.trim() || null,
      version: deployment?.version ?? null,
    };
    try {
      await (deployment
        ? saveCustomerDeployment({ path: { solutionId, id: deployment.id }, body })
        : addCustomerDeployment({ path: { solutionId }, body }));
      notify.success("Solution.done.deploymentSaved", { name: text.title.trim() });
      router.refresh();
      onClose();
    } catch (error) {
      notify.error(solutionError(error));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => (pending || next ? undefined : onClose())}>
      <DialogContent showCloseButton={false} className="max-h-dvh overflow-y-auto sm:max-w-2xl">
        <form className="flex flex-col gap-4" onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{t(deployment ? "editTitle" : "addTitle")}</DialogTitle>
            <DialogDescription>{t("lead")}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-title`}>{t("title")}</FieldLabel>
              <Input
                id={`${id}-title`}
                required
                maxLength={120}
                value={text.title}
                onChange={write("title")}
              />
              <FieldDescription>{t("titleHint")}</FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${id}-customer`}>{t("customer")}</FieldLabel>
                <Input
                  id={`${id}-customer`}
                  required
                  maxLength={120}
                  value={text.customer}
                  onChange={write("customer")}
                />
                <FieldDescription>{t("customerHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-stage`}>{t("stage")}</FieldLabel>
                <NativeSelect
                  id={`${id}-stage`}
                  className="w-full"
                  value={text.stage}
                  onChange={write("stage")}
                >
                  {deploymentStages.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {stage(value)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`${id}-problem`}>{t("problem")}</FieldLabel>
              <Textarea
                id={`${id}-problem`}
                required
                rows={3}
                maxLength={1000}
                value={text.problem}
                onChange={write("problem")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-delivered`}>{t("delivered")}</FieldLabel>
              <Textarea
                id={`${id}-delivered`}
                required
                rows={3}
                maxLength={1000}
                value={text.delivered}
                onChange={write("delivered")}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {optionalFields.map((field) => (
                <Field key={field}>
                  <FieldLabel htmlFor={`${id}-${field}`}>{t(field)}</FieldLabel>
                  <Input
                    id={`${id}-${field}`}
                    maxLength={field === "result" ? 300 : 120}
                    value={text[field]}
                    onChange={write(field)}
                  />
                  {field !== "languages" && (
                    <FieldDescription>{t(`${field}Hint`)}</FieldDescription>
                  )}
                </Field>
              ))}
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button prominence="secondary" disabled={pending} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" pending={pending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type CustomerDeploymentsEditorProps = {
  solutionId: string;
  deployments: CustomerDeployment[];
};

/**
 * The customer deployments of a solution as its owners keep them: each with where its review
 * stands, and a form to add or change one. A change sends the deployment to review again.
 */
function CustomerDeploymentsEditor({ solutionId, deployments }: CustomerDeploymentsEditorProps) {
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

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        {deployments.length < MAX_DEPLOYMENTS ? (
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
              <div className="flex flex-wrap gap-2">
                <Button prominence="secondary" size="sm" onClick={() => setEditing(deployment)}>
                  {t("edit")}
                </Button>
                <Button
                  prominence="tertiary"
                  tone="danger"
                  size="sm"
                  onClick={() => setRemoving(deployment)}
                >
                  {t("remove")}
                </Button>
              </div>
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
