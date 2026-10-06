import { getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { AccountMenu } from "@/components/layout/account-menu";
import { MobileMenu } from "@/components/layout/mobile-menu";
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
    const reviewer = account.role !== "operator" && (await judgesAnyProgram());
    return (
      <>
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
      <Button href={siteRoutes.getStarted}>{t("getStarted")}</Button>
      <MobileMenu />
    </>
  );
}

export { HeaderAccount };
