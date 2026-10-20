import { BrandLockup } from "@/components/layout/brand-lockup";
import { NotFoundNotice } from "@/components/layout/not-found-notice";

/**
 * A missing page outside the public frame (an application, a workspace, the admin area to anyone
 * but an operator): the logo leads home, as on the site. Public pages answer with
 * `(public)/not-found.tsx`, inside the site's header and footer.
 */
export default function NotFoundPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-17 w-full max-w-360 items-center px-5 md:px-8 xl:px-16 desktop:px-20">
          <BrandLockup showBackedBy={false} />
        </div>
      </header>
      <NotFoundNotice />
    </main>
  );
}
