import { getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { AccountMenu } from "@/components/layout/account-menu";
import { HeaderMessages } from "@/components/layout/header-messages";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { readUnread } from "@/features/messaging/messaging-queries";
import { judgesAnyProgram } from "@/features/review/review-queries";
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
    // An operator reviews from the admin area; anyone else finds the programs they judge here.
    const [reviewer, waiting] = await Promise.all([
      account.role !== "operator" && judgesAnyProgram(),
      readUnread(),
    ]);
    return (
      <>
        <HeaderMessages waiting={waiting.unread + waiting.requests} />
        <AccountMenu
          name={account.displayName ?? null}
          email={account.email}
          operator={account.role === "operator"}
          reviewer={reviewer}
        />
        <MobileMenu signedIn />
      </>
    );
  }

  return (
    <>
      <Button prominence="secondary" className="hidden md:inline-flex" href={siteRoutes.signIn}>
        {t("signIn")}
      </Button>
      <Button prominence="inverse" href={siteRoutes.getStarted}>
        {t("getStarted")}
      </Button>
      <MobileMenu />
    </>
  );
}

export { HeaderAccount };
