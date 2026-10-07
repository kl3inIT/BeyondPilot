"use client";

import { useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { useRouter } from "@/i18n/navigation";
import { signOut } from "@/lib/auth/sign-out";
import { siteRoutes } from "@/lib/site";

/**
 * Signs the person out and opens the sign-in page. The app's request cannot be resumed from here,
 * so the person connects again from the app once signed in as the right account.
 */
function SwitchAccount({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <TextButton
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.replace(siteRoutes.signIn);
      }}
    >
      {label}
    </TextButton>
  );
}

export { SwitchAccount };
