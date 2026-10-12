"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
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
import { createSolution } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { solutionError } from "./solution-errors";

type NewSolutionFormProps = {
  onCancel: () => void;
  /**
   * Set when something else takes the new draft on, such as a proposal that opens the editor in a dialog:
   * it is called with the solution's id instead of going to the editor's page.
   */
  onCreated?: (id: string) => void;
};

/** Asks for the name of a new solution. It is created as a draft and opens in its editor. */
function NewSolutionForm({ onCancel, onCreated }: NewSolutionFormProps) {
  const t = useTranslations("Solution.mine.create");
  const locale = useLocale();
  const notify = useNotify();
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setInvalid(true);
      return;
    }
    setPending(true);
    try {
      const { data } = await createSolution({ body: { name } });
      if (onCreated) {
        onCreated(data.id);
        return;
      }
      // The form stays pending until the editor arrives, so a second press cannot create twice.
      router.push(getPathname({ href: `${siteRoutes.workspaceSolutions}/${data.id}`, locale }));
    } catch (error) {
      notify.error(solutionError(error));
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("lead")}</DialogDescription>
      </DialogHeader>
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="solution-new-name">{t("name")}</FieldLabel>
        <Input
          id="solution-new-name"
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={invalid || undefined}
        />
        {invalid && <FieldError>{t("nameRequired")}</FieldError>}
      </Field>
      <DialogFooter>
        <Button prominence="secondary" disabled={pending} onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" size="lg" pending={pending}>
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** The button that starts a solution from its name, asked in a dialog. */
function CreateSolution() {
  const t = useTranslations("Solution.mine.create");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        {t("title")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <NewSolutionForm onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export { CreateSolution, NewSolutionForm };
