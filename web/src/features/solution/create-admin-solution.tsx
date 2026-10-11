"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ChoiceSelect } from "@/components/composites/choice-select";
import { RequiredMark } from "@/components/composites/required-mark";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import {
  createAdminSolution,
  listAdminSolutionOrganizations,
  type AdminSolutionOrganizationOption,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { solutionError } from "./solution-errors";

/**
 * Starts a solution for an organization, as an operator. The organization is one GenAI Fund approved
 * and the name is what the draft is called; it opens in the editor, which the operator publishes from.
 */
function CreateAdminSolution() {
  const t = useTranslations("Admin.solutions.create");
  const locale = useLocale();
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [organizations, setOrganizations] = useState<AdminSolutionOrganizationOption[] | null>(
    null,
  );
  const [organizationId, setOrganizationId] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [tried, setTried] = useState(false);

  async function show() {
    setOpen(true);
    if (organizations !== null) {
      return;
    }
    try {
      const { data } = await listAdminSolutionOrganizations({ query: {} });
      setOrganizations(data);
    } catch (error) {
      notify.error(solutionError(error));
      setOpen(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    if (!organizationId || !name.trim()) {
      return;
    }
    setPending(true);
    try {
      const { data } = await createAdminSolution({ body: { organizationId, name } });
      // The dialog stays pending until the editor arrives, so a second press cannot create twice.
      router.push(getPathname({ href: `${siteRoutes.adminSolutions}/${data.id}/edit`, locale }));
    } catch (error) {
      notify.error(solutionError(error));
      setPending(false);
    }
  }

  const noOrganization = tried && !organizationId;
  const noName = tried && !name.trim();

  return (
    <>
      <Button size="lg" onClick={show}>
        <PlusIcon aria-hidden="true" />
        {t("action")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false}>
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("lead")}</DialogDescription>
            </DialogHeader>
            <Field data-invalid={noOrganization || undefined}>
              <FieldLabel htmlFor="admin-solution-organization">
                {t("organization")}
                <RequiredMark />
              </FieldLabel>
              <ChoiceSelect
                id="admin-solution-organization"
                options={(organizations ?? []).map(({ id, name: label }) => ({ value: id, label }))}
                value={organizationId}
                onValueChange={setOrganizationId}
                placeholder={t("organizationPlaceholder")}
                aria-required
                aria-invalid={noOrganization || undefined}
              />
              {organizations?.length === 0 && <FieldError>{t("noOrganizations")}</FieldError>}
              {noOrganization && <FieldError>{t("organizationRequired")}</FieldError>}
            </Field>
            <Field data-invalid={noName || undefined}>
              <FieldLabel htmlFor="admin-solution-name">
                {t("name")}
                <RequiredMark />
              </FieldLabel>
              <Input
                id="admin-solution-name"
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-required
                aria-invalid={noName || undefined}
              />
              {noName && <FieldError>{t("nameRequired")}</FieldError>}
            </Field>
            <DialogFooter>
              <Button prominence="secondary" disabled={pending} onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="lg" pending={pending}>
                {t("submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { CreateAdminSolution };
