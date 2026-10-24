"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { makeAdminUseCasePrivate, makeAdminUseCasePublic } from "@/lib/api/generated";

type AdminUseCaseVisibilityProps = {
  id: string;
  title: string;
  /** What the use case is now: a public one can be hidden; any other that is not in review can be made public. */
  status: "approved" | "private" | "draft" | "needs_changes";
  /** A button on the use case's record, or an item of its row's menu in the list. */
  appearance: "button" | "item";
};

/**
 * Makes a use case private or public. An operator's decision needs no review, nobody is emailed, and
 * either change can be undone, so it runs at once and its toast offers Undo (docs/conventions.md ›
 * Actions).
 */
function AdminUseCaseVisibility({ id, title, status, appearance }: AdminUseCaseVisibilityProps) {
  const t = useTranslations("Admin.useCases.visibility");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const hides = status === "approved";

  /** Hides the use case or makes it public; what Undo sends offers no Undo of its own. */
  async function change(toPrivate: boolean, undoable: boolean) {
    setPending(true);
    try {
      await (toPrivate ? makeAdminUseCasePrivate : makeAdminUseCasePublic)({ path: { id } });
      notify.success(
        toPrivate
          ? "Admin.useCases.visibility.done.private"
          : "Admin.useCases.visibility.done.public",
        { name: title },
        undoable && (toPrivate || status === "private")
          ? { undo: () => void change(!toPrivate, false) }
          : undefined,
      );
      router.refresh();
    } catch (error) {
      notify.failure(error, { otherwise: "Admin.useCases.errors.unknown" });
    } finally {
      setPending(false);
    }
  }

  const toggle = () => (pending ? undefined : change(hides, true));
  const label = hides ? t("makePrivate") : status === "private" ? t("makePublic") : t("publish");

  if (appearance === "item") {
    return (
      <DropdownMenuItem disabled={pending} onClick={() => void toggle()}>
        {label}
      </DropdownMenuItem>
    );
  }

  return (
    <Button
      size="lg"
      prominence={hides ? "secondary" : "primary"}
      pending={pending}
      onClick={() => void toggle()}
    >
      {hides ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
      {label}
    </Button>
  );
}

export { AdminUseCaseVisibility };
