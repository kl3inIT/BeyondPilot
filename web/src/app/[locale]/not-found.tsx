import { NotFoundNotice } from "@/components/layout/not-found-notice";
import { PublicFrame } from "@/components/layout/public-frame";

/**
 * A missing page outside the public frame (an application, a workspace, the admin area to anyone
 * but an operator), drawn in that frame: it reads exactly as an unknown public address does, so a
 * refusal tells nothing of the area behind it. Public pages answer with `(public)/not-found.tsx`.
 */
export default function NotFoundPage() {
  return (
    <PublicFrame>
      <NotFoundNotice />
    </PublicFrame>
  );
}
