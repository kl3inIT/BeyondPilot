/**
 * The companies, teams and builders on BeyondPilot and the people who belong to them: how a person gets in (creating
 * an organization, joining by the domain of their address, an invitation, a request), what owners manage, and what
 * GenAI Fund reviews. Other modules ask {@link ai.genaifund.beyondpilot.organization.OrganizationDirectory} which
 * organization a person acts for.
 */
@ApplicationModule(displayName = "Organization", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity", "notification", "storage" })
@NullMarked
package ai.genaifund.beyondpilot.organization;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
