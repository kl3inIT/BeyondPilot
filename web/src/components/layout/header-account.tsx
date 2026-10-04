import { getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { AccountMenu } from "@/components/layout/account-menu";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { getCurrentAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

/**
 * The right end of the header, decided on the server from the session: a visitor is offered the
 * two ways in, a signed-in person gets their account menu. Reading the session here means the
 * first paint is already right and nothing swaps after it.
 */
async function HeaderAccount() {
  const [account, t] = await Promise.all([getCurrentAccount(), getTranslations("Site.nav")]);

  if (account) {
    return (
      <>
        <AccountMenu
          name={account.displayName ?? null}
          email={account.email}
          operator={account.role === "operator"}
        />
        <MobileMenu signedIn />
      </>
    );
  }

  return (
    <>
      <Button prominence="tertiary" className="hidden md:inline-flex" href={siteRoutes.signIn}>
        {t("signIn")}
      </Button>
      <Button prominence="secondary" href={siteRoutes.getStarted}>
        {t("getStarted")}
      </Button>
      <MobileMenu />
    </>
  );
}

export { HeaderAccount };
