"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import { createAdminOrganization } from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";

import { organizationError } from "./organization-errors";

const blank = { name: "", ownerEmail: "", website: "" };

/**
 * Creates an organization on behalf of its people, already approved: GenAI Fund lists a company
 * before anyone from it signs in. With an owner's address, that person is invited to own it; without
 * one, the first person on its email domain owns it, or someone claims it.
 */
function AdminCreateOrganization() {
  const t = useTranslations("Admin.organizations.create");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(blank);
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());

  const write = (field: keyof typeof blank) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setText((current) => ({ ...current, [field]: event.target.value }));
  const bad = (field: string) => invalid.has(field) || undefined;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = new Set<string>();
    if (!text.name.trim()) {
      missing.add("name");
    }
    setInvalid(missing);
    if (missing.size > 0) {
      return;
    }
    setPending(true);
    try {
      await createAdminOrganization({
        body: {
          name: text.name,
          type: "company",
          ownerEmail: text.ownerEmail.trim() || null,
          website: text.website.trim() || null,
        },
      });
      notify.success("Organization.done.adminCreated", { name: text.name.trim() });
      setOpen(false);
      setText(blank);
      router.refresh();
    } catch (error) {
      setInvalid(rejectedFields(error));
      notify.error(organizationError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle size="lg">{t("title")}</DialogTitle>
            </DialogHeader>
            <FieldGroup>
              <Field data-invalid={bad("name")}>
                <FieldLabel htmlFor="admin-organization-name">{t("name")}</FieldLabel>
                <Input
                  id="admin-organization-name"
                  maxLength={120}
                  value={text.name}
                  onChange={write("name")}
                  aria-invalid={bad("name")}
                />
                {bad("name") && <FieldError>{t("nameRequired")}</FieldError>}
              </Field>
              <Field data-invalid={bad("ownerEmail")}>
                <FieldLabel htmlFor="admin-organization-owner">{t("ownerEmail")}</FieldLabel>
                <Input
                  id="admin-organization-owner"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  value={text.ownerEmail}
                  onChange={write("ownerEmail")}
                  aria-invalid={bad("ownerEmail")}
                />
                {bad("ownerEmail") ? (
                  <FieldError>{t("ownerEmailInvalid")}</FieldError>
                ) : (
                  <FieldDescription>{t("ownerEmailHint")}</FieldDescription>
                )}
              </Field>
              <Field data-invalid={bad("website")}>
                <FieldLabel htmlFor="admin-organization-website">{t("website")}</FieldLabel>
                <Input
                  id="admin-organization-website"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  maxLength={300}
                  value={text.website}
                  onChange={write("website")}
                  aria-invalid={bad("website")}
                />
                {bad("website") && <FieldError>{t("websiteInvalid")}</FieldError>}
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button prominence="secondary" disabled={pending} onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" pending={pending}>
                {t("confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { AdminCreateOrganization };
