"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import type { Organization } from "@/lib/api/generated";

import { OrganizationForm } from "./organization-form";
import { OrganizationProfileView } from "./organization-profile-view";

type OrganizationProfileEditorProps = {
  organization: Organization;
  /** Set when an operator changes the organization, as in the form. */
  admin?: boolean;
};

/**
 * An organization's profile for whoever may change it: it reads as facts until they choose to edit,
 * so a change is always meant. A save gives the page a new version, and the editor that the page
 * keys by it opens reading again. Cancel returns the focus to the button that opened the form.
 */
function OrganizationProfileEditor({ organization, admin }: OrganizationProfileEditorProps) {
  const t = useTranslations("Organization.form");
  const [editing, setEditing] = useState(false);
  const [cancelled, setCancelled] = useState(false);

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
        <Button prominence="secondary" autoFocus={cancelled} onClick={() => setEditing(true)}>
          {t("edit")}
        </Button>
      }
    />
  );
}

export { OrganizationProfileEditor };
