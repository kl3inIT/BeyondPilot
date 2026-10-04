"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { redeemSignInLink } from "@/features/identity/identity-api";
import { SignInForm } from "@/features/identity/sign-in-form";

type SignInLinkPageProps = {
  token?: string;
  /** A path of this site, already checked, to open once signed in. */
  returnTo?: string;
  /** Where to go when the link carries no return path. */
  home: string;
};

/**
 * The page an emailed link opens. It posts the token instead of signing in on the page load, so a
 * mail scanner that only fetches the link does not use it up. A link that no longer works asks for
 * the address again.
 */
function SignInLinkPage({ token, returnTo, home }: SignInLinkPageProps) {
  const t = useTranslations("SignIn.signingIn");
  const [expired, setExpired] = useState(!token);
  const started = useRef(false);

  useEffect(() => {
    // Development runs effects twice; a token works once.
    if (!token || started.current) {
      return;
    }
    started.current = true;
    void redeemSignInLink(token).then((signedIn) => {
      if (signedIn) {
        // A full load, so every server-rendered part of the next page sees the new session.
        window.location.replace(returnTo ?? home);
      } else {
        setExpired(true);
      }
    });
  }, [token, returnTo, home]);

  if (expired) {
    return <SignInForm variant="expired" returnTo={returnTo} />;
  }

  return (
    <>
      <h1 className="flex items-center gap-2.5 text-lg font-semibold">
        <Spinner className="size-5" aria-hidden="true" />
        {t("title")}
      </h1>
      <p className="text-muted-foreground">{t("lead")}</p>
    </>
  );
}

export { SignInLinkPage };
