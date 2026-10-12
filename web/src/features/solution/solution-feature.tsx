"use client";

import { StarIcon, StarOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { featureSolution, unfeatureSolution, type AdminSolutionSummary } from "@/lib/api/generated";

import { solutionError } from "./solution-errors";

type SolutionFeatureProps = {
  solution: Pick<AdminSolutionSummary, "id" | "name" | "featuredAt">;
  /** A button on the solution's record, or an item of its row's menu in the list. */
  appearance: "button" | "item";
};

/**
 * Features a solution, or stops featuring it. Nobody is emailed and nothing else about the solution
 * changes, so it asks for no confirmation: the other press undoes it.
 */
function SolutionFeature({ solution, appearance }: SolutionFeatureProps) {
  const t = useTranslations("Admin.solutions.feature");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const featured = Boolean(solution.featuredAt);

  async function toggle() {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await (featured ? unfeatureSolution : featureSolution)({ path: { id: solution.id } });
      notify.success(featured ? "Solution.done.unfeatured" : "Solution.done.featured", {
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
        {t(featured ? "unfeature" : "feature")}
      </DropdownMenuItem>
    );
  }

  return (
    <Button
      className="w-full"
      prominence="secondary"
      pending={pending}
      onClick={() => void toggle()}
    >
      {featured ? <StarOffIcon aria-hidden="true" /> : <StarIcon aria-hidden="true" />}
      {t(featured ? "unfeature" : "feature")}
    </Button>
  );
}

export { SolutionFeature };
