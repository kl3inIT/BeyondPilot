"use client";

import { EllipsisIcon, EyeOffIcon, MergeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Organization } from "@/lib/api/generated";

import { MergeDialog } from "./organization-merge";
import { TakeDownDialog } from "./organization-take-down";

type AdminOrganizationMenuProps = {
  organization: Pick<Organization, "id" | "name">;
  /** Whether it is approved and shown, so it can be taken down. */
  canTakeDown: boolean;
  members: number;
  invitations: number;
};

/**
 * What an operator does to an organization from its record, in a menu: merge a duplicate into the
 * one to keep, and take an approved one down.
 */
function AdminOrganizationMenu({
  organization,
  canTakeDown,
  members,
  invitations,
}: AdminOrganizationMenuProps) {
  const t = useTranslations("Admin.organizations");
  const [open, setOpen] = useState<"takeDown" | "merge" | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("takeDown.open", { name: organization.name })}
              className="hit-area flex size-9 shrink-0 items-center justify-center rounded-md border outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
            />
          }
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setOpen("merge")}>
              <MergeIcon aria-hidden="true" />
              {t("merge.menu")}
            </DropdownMenuItem>
            {canTakeDown && (
              <DropdownMenuItem variant="destructive" onClick={() => setOpen("takeDown")}>
                <EyeOffIcon aria-hidden="true" />
                {t("takeDown.menu")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {open === "takeDown" && (
        <TakeDownDialog
          organization={organization}
          members={members}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "merge" && (
        <MergeDialog
          organization={organization}
          members={members}
          invitations={invitations}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

export { AdminOrganizationMenu };
