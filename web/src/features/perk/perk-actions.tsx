"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { FormDialog } from "@/components/composites/form-dialog";
import { Status } from "@/components/composites/status";
import { useAppForm } from "@/components/form/app-form";
import { useSearchedOptions } from "@/components/form/use-searched-options";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import {
  archiveAdminPerk,
  archiveMyPerk,
  deleteAdminPerk,
  deleteMyPerk,
  listAdminSolutionOrganizations,
  publishAdminPerk,
  publishMyPerk,
  type Perk,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

type Side = "own" | "admin";

/** Where a perk's state stands: a draft, published, or archived. */
function PerkState({ state }: { state: Perk["state"] }) {
  const t = useTranslations("Perk.manage.state");
  const tone = state === "published" ? "success" : state === "archived" ? "neutral" : "warning";
  return (
    <Status tone={tone} appearance="pill">
      {t(state)}
    </Status>
  );
}

/**
 * The actions of a perk's record: publishing a draft, archiving a published perk, and deleting one
 * nobody got. Publishing runs at once; archiving closes the perk for good to new teams, and deleting
 * removes it, so those are asked.
 */
function PerkActions({ perk, side }: { perk: Perk; side: Side }) {
  const t = useTranslations("Perk.manage");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState<"archive" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const admin = side === "admin";
  const path = { path: { id: perk.id } };

  async function run(action: "publish" | "archive" | "delete") {
    setPending(true);
    try {
      if (action === "publish") {
        await (admin ? publishAdminPerk : publishMyPerk)(path);
      } else if (action === "archive") {
        await (admin ? archiveAdminPerk : archiveMyPerk)(path);
      } else {
        await (admin ? deleteAdminPerk : deleteMyPerk)(path);
      }
      notify.success(`Perk.manage.done.${action}`, { name: perk.title });
      setAsking(null);
      if (action === "delete") {
        router.push(admin ? siteRoutes.adminPerks : siteRoutes.workspacePerks);
        return;
      }
    } catch (error) {
      notify.failure(error);
      setAsking(null);
    } finally {
      setPending(false);
    }
    router.refresh();
  }

  if (!perk.editable) {
    return null;
  }

  return (
    <>
      {perk.state === "published" && (
        <Button prominence="secondary" size="lg" href={`${siteRoutes.perks}/${perk.slug}`}>
          {t("view")}
        </Button>
      )}
      {perk.state === "draft" && (
        <Button size="lg" pending={pending && asking === null} onClick={() => run("publish")}>
          {t("publish")}
        </Button>
      )}
      {perk.state === "published" && (
        <Button prominence="secondary" size="lg" onClick={() => setAsking("archive")}>
          {t("archive")}
        </Button>
      )}
      {perk.taken === 0 && perk.waiting === 0 && (
        <Button prominence="tertiary" tone="danger" size="lg" onClick={() => setAsking("delete")}>
          {t("delete")}
        </Button>
      )}

      <ConfirmDialog
        open={asking === "archive"}
        onOpenChange={(next) => setAsking(next ? "archive" : null)}
        title={t("confirmArchive.title", { name: perk.title })}
        description={t("confirmArchive.lead")}
        confirmLabel={t("archive")}
        cancelLabel={t("cancel")}
        pending={pending}
        onConfirm={() => run("archive")}
      />
      <ConfirmDialog
        open={asking === "delete"}
        onOpenChange={(next) => setAsking(next ? "delete" : null)}
        title={t("confirmDelete.title", { name: perk.title })}
        description={t("confirmDelete.lead")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={() => run("delete")}
      />
    </>
  );
}

/** The organizations an operator can write a perk for whose name holds the text. */
async function findOrganizations(text: string | undefined) {
  const { data } = await listAdminSolutionOrganizations({ query: { q: text } });
  return data.map(({ id, name }) => ({ value: id, label: name }));
}

/**
 * Starts a perk as an operator: the organization that gives it is chosen first, and the form opens
 * for it.
 */
function CreateAdminPerk() {
  const t = useTranslations("Perk.manage.create");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: { organizationId: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({ organizationId: z.string().min(1, t("organizationRequired")) }),
    },
    onSubmit: ({ value }) => {
      router.push(`${siteRoutes.adminPerks}/new?${new URLSearchParams(value)}`);
    },
  });
  const organizationId = useStore(form.store, (state) => state.values.organizationId);
  const organizations = useSearchedOptions(open ? findOrganizations : null, organizationId);

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {t("action")}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        title={t("title")}
        submitLabel={t("submit")}
        cancelLabel={t("cancel")}
      >
        <form.AppField name="organizationId">
          {(field) => (
            <field.ComboboxField
              label={t("organization")}
              requiredMark
              placeholder={t("organizationPlaceholder")}
              options={organizations.options}
              search={organizations.search}
            />
          )}
        </form.AppField>
      </FormDialog>
    </>
  );
}

export { CreateAdminPerk, PerkActions, PerkState };
