"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { createMyUseCase } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { describeUseCaseError } from "./my-use-case-errors";

/**
 * Starts an empty draft for the organization and opens it, so that what the members write is saved from
 * the first letter. The button stays pending until the draft opens, so one click makes one draft.
 */
function PostUseCase({
  prominence = "primary",
  another = false,
}: {
  prominence?: "primary" | "secondary";
  /** Worded as one more, after a use case has just been sent. */
  another?: boolean;
}) {
  const t = useTranslations("Organization.useCases");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    try {
      const { data } = await createMyUseCase();
      router.push(`${siteRoutes.workspaceUseCases}/${data.id}`);
    } catch (error) {
      notify.error(describeUseCaseError(error));
      setPending(false);
    }
  }

  return (
    <Button prominence={prominence} pending={pending} onClick={start}>
      {t(another ? "postAnother" : "post")}
    </Button>
  );
}

export { PostUseCase };
