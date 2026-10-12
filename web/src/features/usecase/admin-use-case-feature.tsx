"use client";

import { StarIcon, StarOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { featureAdminUseCase, unfeatureAdminUseCase } from "@/lib/api/generated";

type AdminUseCaseFeatureProps = {
  id: string;
  title: string;
  featured: boolean;
  /** A button on the use case's record, or an item of its row's menu in the list. */
  appearance: "button" | "item";
};

/**
 * Features a use case, or stops featuring it. Nobody is emailed and nothing else about the use case
 * changes, so it runs at once and its toast offers Undo (docs/conventions.md › Actions).
 */
function AdminUseCaseFeature({ id, title, featured, appearance }: AdminUseCaseFeatureProps) {
  const t = useTranslations("Admin.useCases.feature");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  /** Features the use case or stops featuring it; what Undo sends offers no Undo of its own. */
  async function feature(next: boolean, undoable: boolean) {
    setPending(true);
    try {
      await (next ? featureAdminUseCase : unfeatureAdminUseCase)({ path: { id } });
      notify.success(
        next ? "Admin.useCases.feature.done.featured" : "Admin.useCases.feature.done.unfeatured",
        { name: title },
        undoable ? { undo: () => void feature(!next, false) } : undefined,
      );
      router.refresh();
    } catch (error) {
      notify.failure(error, { otherwise: "Admin.useCases.errors.unknown" });
    } finally {
      setPending(false);
    }
  }

  const toggle = () => (pending ? undefined : feature(!featured, true));

  if (appearance === "item") {
    return (
      <DropdownMenuItem disabled={pending} onClick={() => void toggle()}>
        {t(featured ? "unfeature" : "feature")}
      </DropdownMenuItem>
    );
  }

  return (
    <Button prominence="secondary" pending={pending} onClick={() => void toggle()}>
      {featured ? <StarOffIcon aria-hidden="true" /> : <StarIcon aria-hidden="true" />}
      {t(featured ? "unfeature" : "feature")}
    </Button>
  );
}

export { AdminUseCaseFeature };
