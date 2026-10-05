"use client";

import { useTranslations } from "next-intl";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { requestIntroduction } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { introductionError } from "./introduction-errors";

type RequestIntroductionProps = {
  /** The address of the solution the visitor asks about. */
  slug: string;
  /** The organization that offers it: the one the introduction is to. */
  provider: string;
  /** The organization the caller asks as; absent when they belong to none. */
  organization: string | null;
  /** True when their organization waits for GenAI Fund's approval, so it cannot ask yet. */
  awaitingApproval: boolean;
  /** Where a visitor signs in to ask; absent for someone signed in. */
  signInHref?: string;
};

/**
 * "Request an introduction": asks GenAI Fund to introduce the caller's organization to the one behind
 * a solution. The provider's owners read who asks before they answer, and neither address is shown
 * until they do. A visitor is sent to sign in; a person who cannot ask yet is told what is missing.
 */
function RequestIntroduction({
  slug,
  provider,
  organization,
  awaitingApproval,
  signInHref,
}: RequestIntroductionProps) {
  const t = useTranslations("Introduction.request");
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [sent, setSent] = useState(false);
  const blocked = organization === null ? "organization" : awaitingApproval ? "approval" : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setPending(true);
    try {
      await requestIntroduction({ body: { solutionSlug: slug, message } });
      setSent(true);
    } catch (error) {
      notify.error(introductionError(error));
    } finally {
      setPending(false);
    }
  }

  function close(next: boolean) {
    if (pending) {
      return;
    }
    setOpen(next);
    if (!next && sent) {
      // A later request starts empty; the one just sent stays waiting.
      setSent(false);
      setMessage("");
    }
  }

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        {...(signInHref ? { href: signInHref } : { onClick: () => setOpen(true) })}
      >
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent showCloseButton={false}>
          {sent ? (
            <div className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{t("sent.title", { provider })}</DialogTitle>
                <DialogDescription>{t("sent.lead")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button size="lg" onClick={() => close(false)}>
                  {t("sent.done")}
                </Button>
              </DialogFooter>
            </div>
          ) : blocked ? (
            <div className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{t(`blocked.${blocked}.title`)}</DialogTitle>
                <DialogDescription>{t(`blocked.${blocked}.lead`)}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button prominence="secondary" onClick={() => close(false)}>
                  {t("cancel")}
                </Button>
                {blocked === "organization" && (
                  <Button size="lg" href={siteRoutes.workspaceOrganization}>
                    {t("blocked.organization.action")}
                  </Button>
                )}
              </DialogFooter>
            </div>
          ) : (
            <form noValidate onSubmit={submit} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{t("title", { provider })}</DialogTitle>
                <DialogDescription>{t("lead", { provider })}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t("organization")}</span>
                <p className="rounded-lg border bg-muted px-3 py-2 text-sm">{organization}</p>
              </div>
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="introduction-message">{t("message")}</FieldLabel>
                <Textarea
                  id="introduction-message"
                  rows={5}
                  maxLength={2000}
                  placeholder={t("placeholder")}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  aria-invalid={invalid || undefined}
                />
                {invalid ? (
                  <FieldError>{t("required")}</FieldError>
                ) : (
                  <FieldDescription>{t("hint", { provider })}</FieldDescription>
                )}
              </Field>
              <DialogFooter>
                <Button prominence="secondary" disabled={pending} onClick={() => close(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit" size="lg" pending={pending}>
                  {t("send")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export { RequestIntroduction };
