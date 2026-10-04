"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Spinner } from "@/components/ui/spinner";
import { googleSignInPath } from "@/features/identity/identity-api";

type GoogleButtonProps = {
  returnTo?: string;
  /** The round trip has started: the browser is leaving for Google. */
  pending: boolean;
  /** Another method is in progress. */
  disabled: boolean;
  onStart: () => void;
};

/** Starts the Google round trip: a plain link to the backend, which redirects to Google. */
function GoogleButton({ returnTo, pending, disabled, onStart }: GoogleButtonProps) {
  const t = useTranslations("SignIn");

  return (
    <Button
      prominence="secondary"
      size="lg"
      className="w-full"
      href={googleSignInPath(returnTo)}
      aria-busy={pending || undefined}
      aria-disabled={disabled || undefined}
      onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
        if (disabled) {
          event.preventDefault();
        } else {
          onStart();
        }
      }}
    >
      {pending ? (
        <Spinner aria-hidden="true" />
      ) : (
        <Image src="/brand/google-g.svg" alt="" width={18} height={18} />
      )}
      {t("google")}
    </Button>
  );
}

export { GoogleButton };
