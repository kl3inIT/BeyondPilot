"use client";

import { PinIcon, PinOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { pinSolution, unpinSolution, type AdminSolutionSummary } from "@/lib/api/generated";

import { solutionError } from "./solution-errors";

type SolutionPinProps = {
  solution: Pick<AdminSolutionSummary, "id" | "name" | "pinnedAt">;
  /** A button on the solution's record, or an item of its row's menu in the list. */
  appearance: "button" | "item";
};

/**
 * Pins a solution to the top of the public directory, or unpins it. Nobody is emailed and nothing
 * else about the solution changes, so it asks for no confirmation: the other press undoes it.
 */
function SolutionPin({ solution, appearance }: SolutionPinProps) {
  const t = useTranslations("Admin.solutions.pin");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const pinned = Boolean(solution.pinnedAt);

  async function toggle() {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await (pinned ? unpinSolution : pinSolution)({ path: { id: solution.id } });
      notify.success(pinned ? "Solution.done.unpinned" : "Solution.done.pinned", {
        name: solution.name,
      });
      router.refresh();
    } catch (error) {
      notify.error(solutionError(error));
    } finally {
      setPending(false);
    }
  }

  if (appearance === "item") {
    return (
      <DropdownMenuItem disabled={pending} onClick={() => void toggle()}>
        {t(pinned ? "unpin" : "pin")}
      </DropdownMenuItem>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="w-full"
        prominence="secondary"
        pending={pending}
        onClick={() => void toggle()}
      >
        {pinned ? <PinOffIcon aria-hidden="true" /> : <PinIcon aria-hidden="true" />}
        {t(pinned ? "unpin" : "pin")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}

export { SolutionPin };
