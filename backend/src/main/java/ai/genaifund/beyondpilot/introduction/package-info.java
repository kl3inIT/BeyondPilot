/**
 * The introductions people ask for to the organization behind a solution: what the sender writes, and the answer of the
 * provider's owners. Neither side learns the other's email address before the answer.
 */
@ApplicationModule(displayName = "Introduction", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity", "notification", "organization", "solution" })
@NullMarked
package ai.genaifund.beyondpilot.introduction;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
