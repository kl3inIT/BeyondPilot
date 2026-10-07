import type { MyOrganization, Organization } from "@/lib/api/generated";

import { OrganizationFrame } from "./organization-frame";
import { OrganizationProfileEditor } from "./organization-profile-editor";
import { OrganizationProfileView } from "./organization-profile-view";

type OrganizationProfilePageProps = {
  mine: MyOrganization & { organization: Organization };
  counts: { members: number; solutions: number | null; useCases: number | null };
};

/**
 * My organization › Profile. An owner changes it; a member reads it. Saving a refused organization
 * sends it to review again, which the frame's notice says.
 */
function OrganizationProfilePage({ mine, counts }: OrganizationProfilePageProps) {
  const { organization } = mine;

  return (
    <OrganizationFrame mine={mine} current="profile" counts={counts}>
      {mine.role === "owner" ? (
        // The key gives a saved organization a fresh editor, reading the new version.
        <OrganizationProfileEditor key={organization.version} organization={organization} />
      ) : (
        <OrganizationProfileView organization={organization} />
      )}
    </OrganizationFrame>
  );
}

export { OrganizationProfilePage };
