package ai.genaifund.beyondpilot.organization;

import java.util.UUID;

/**
 * An organization's owners saved its profile, which may have changed the name or the country other modules show next to
 * their own records. It names the organization only.
 */
public record OrganizationChanged(UUID organizationId) {
}
