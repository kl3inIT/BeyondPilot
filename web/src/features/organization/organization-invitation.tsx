"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import {
  acceptOrganizationInvitation,
  changeMyJobTitle,
  declineOrganizationInvitation,
  type OrganizationInvitation as Invitation,
} from "@/lib/api/generated";

import { organizationError } from "./organization-errors";
import { OrganizationMark } from "./organization-mark";

/**
 * An invitation to an organization, as the invited person answers it: accept, with the job title
 * they go by there, or decline. An owner's invitation says what an owner can do.
 */
function OrganizationInvitation({ invitation }: { invitation: Invitation }) {
  const t = useTranslations("Organization.entry.invitation");
  const format = useFormatter();
  const notify = useNotify();
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState("");
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const owner = invitation.role === "owner";

  async function accept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("accept");
    try {
      await acceptOrganizationInvitation({ path: { id: invitation.id } });
      // The job title belongs to the membership, so it is written once the person has joined.
      const title = jobTitle.trim();
      if (title) {
        await changeMyJobTitle({ body: { jobTitle: title } }).catch(() => undefined);
      }
      notify.success("Organization.done.invitationAccepted");
      router.refresh();
    } catch (error) {
      notify.error(organizationError(error));
      setPending(null);
    }
  }

  async function decline() {
    setPending("decline");
    try {
      await declineOrganizationInvitation({ path: { id: invitation.id } });
      notify.success("Organization.done.invitationDeclined");
      router.refresh();
    } catch (error) {
      notify.error(organizationError(error));
      setPending(null);
    }
  }

  return (
    <div className="flex w-full max-w-100 flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-title">
        {t("title", { name: invitation.organizationName })}
      </h1>
      <div className="flex items-center gap-3.5 border-y py-3.5">
        <OrganizationMark name={invitation.organizationName} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{invitation.organizationName}</span>
          <span className="text-xs text-muted-foreground">
            {t("invitedOn", {
              name: invitation.invitedBy,
              day: format.dateTime(new Date(invitation.createdAt), { dateStyle: "medium" }),
            })}
          </span>
        </div>
      </div>
      <form noValidate onSubmit={accept} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="invitation-job-title">{t("jobTitle")}</FieldLabel>
          <Input
            id="invitation-job-title"
            autoComplete="organization-title"
            maxLength={120}
            placeholder={t(owner ? "jobTitlePlaceholderOwner" : "jobTitlePlaceholder")}
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          pending={pending === "accept"}
          disabled={pending !== null}
        >
          {t(owner ? "acceptOwner" : "accept")}
        </Button>
        <Button
          prominence="tertiary"
          size="lg"
          className="w-full"
          pending={pending === "decline"}
          disabled={pending !== null}
          onClick={decline}
        >
          {t("decline")}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        {t(owner ? "noteOwner" : "noteMember", {
          inviter: invitation.invitedBy,
          email: invitation.email,
          name: invitation.organizationName,
        })}
      </p>
    </div>
  );
}

export { OrganizationInvitation };
