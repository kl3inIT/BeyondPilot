import { getTranslations } from "next-intl/server";

import type { Me } from "@/lib/api/generated";

import { AccountContactForm } from "./account-contact-form";

/** A person's account: who they signed in as, and where and how to reach them. */
async function AccountPage({ account }: { account: Me }) {
  const t = await getTranslations("Account");

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 pt-10 pb-16 md:px-8 md:pt-14 md:pb-24 lg:px-16">
      <div className="flex w-full max-w-220 flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-3xl leading-none font-semibold tracking-title md:text-5xl md:leading-none">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        <AccountContactForm account={account} />
      </div>
    </div>
  );
}

export { AccountPage };
