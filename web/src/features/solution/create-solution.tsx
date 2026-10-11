"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
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

type CreateSolutionProps = {
  /**
   * Set when something else takes the new draft on, such as a proposal that opens the editor in a dialog:
   * it is called with the solution's id instead of going to the editor's page, and the trigger is a
   * text button.
   */
  onCreated?: (id: string) => void;
};

/** Starts a solution from its name, asked in a dialog. It is created as a draft and opens in its editor. */
function CreateSolution({ onCreated }: CreateSolutionProps) {
  const t = useTranslations("Solution.mine.create");
  const locale = useLocale();
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
        setOpen(false);
        setPending(false);
        setName("");
        onCreated(data.id);
        return;
      }
      // The dialog stays pending until the editor arrives, so a second press cannot create twice.
      router.push(getPathname({ href: `${siteRoutes.workspaceSolutions}/${data.id}`, locale }));
    } catch (error) {
      notify.error(solutionError(error));
      setPending(false);
    }
  }

  return (
    <>
      {onCreated ? (
        <TextButton onClick={() => setOpen(true)}>{t("title")}</TextButton>
      ) : (
        <Button size="lg" onClick={() => setOpen(true)}>
          {t("title")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false}>
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

export { CreateSolution };
