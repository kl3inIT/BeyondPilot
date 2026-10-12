"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import type { Organization } from "@/lib/api/generated";

import { OrganizationForm } from "./organization-form";
import { OrganizationProfileView } from "./organization-profile-view";
import { missingProfileFacts } from "./organization-schemas";

type OrganizationProfileEditorProps = {
  organization: Organization;
  /** Set when an operator changes the organization, as in the form. */
  admin?: boolean;
};

/**
 * An organization's profile for whoever may change it: it reads as facts until they choose to edit,
 * so a change is always meant. A save gives the page a new version, and the editor that the page
 * keys by it opens reading again. Cancel returns the focus to the button that opened the form.
 * While its owner's organization waits for review without a fact the form asks for, opening the
 * form is the page's one primary action and says what it is for, as the notice above it does.
 */
function OrganizationProfileEditor({ organization, admin }: OrganizationProfileEditorProps) {
  const t = useTranslations("Organization.form");
  const [editing, setEditing] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const incomplete =
    !admin && organization.status === "in_review" && missingProfileFacts(organization).length > 0;

  if (editing) {
    return (
      <OrganizationForm
        organization={organization}
        admin={admin}
        onCancel={() => {
          setCancelled(true);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <OrganizationProfileView
      organization={organization}
      action={
        <Button
          prominence={incomplete ? "primary" : "secondary"}
          autoFocus={cancelled}
          onClick={() => setEditing(true)}
        >
          {t(incomplete ? "complete" : "edit")}
        </Button>
      }
    />
  );
}

export { OrganizationProfileEditor };
