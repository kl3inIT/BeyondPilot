"use client";

import { StarIcon, StarOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
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
 * changes, so it asks for no confirmation: the other press undoes it.
 */
function AdminUseCaseFeature({ id, title, featured, appearance }: AdminUseCaseFeatureProps) {
  const t = useTranslations("Admin.useCases.feature");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await (featured ? unfeatureAdminUseCase : featureAdminUseCase)({ path: { id } });
      notify.success(
        featured
          ? "Admin.useCases.feature.done.unfeatured"
          : "Admin.useCases.feature.done.featured",
        { name: title },
      );
      router.refresh();
    } catch (error) {
      notify.error(
        error instanceof ApiError && error.code === "USECASE_NOT_FOUND"
          ? "Admin.useCases.errors.USECASE_NOT_FOUND"
          : "Admin.useCases.errors.unknown",
      );
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
    <Button prominence="secondary" pending={pending} onClick={() => void toggle()}>
      {featured ? <StarOffIcon aria-hidden="true" /> : <StarIcon aria-hidden="true" />}
      {t(featured ? "unfeature" : "feature")}
    </Button>
  );
}

export { AdminUseCaseFeature };
