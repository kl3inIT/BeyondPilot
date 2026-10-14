"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { assignProgramConversation, type AccountSummary } from "@/lib/api/generated";

export function ProgramAssignmentAction({
  id,
  operators,
}: {
  id: string;
  operators: AccountSummary[];
}) {
  const t = useTranslations("Messaging.assignments");
  const router = useRouter();
  const notify = useNotify();
  const [pending, setPending] = useState(false);

  async function assign(accountId: string) {
    setPending(true);
    try {
      await assignProgramConversation({ path: { id, accountId } });
      router.refresh();
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button prominence="secondary" size="sm" pending={pending} />}>
        {t("assign")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {operators.map((operator) => (
            <DropdownMenuItem key={operator.id} onClick={() => void assign(operator.id)}>
              {operator.displayName ?? operator.email}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
