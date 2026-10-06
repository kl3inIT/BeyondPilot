/**
 * The talent profiles of people: what a person writes about themselves and submits, what GenAI Fund reviews, the
 * public directory of the approved ones, and the messages sent through a profile, which share the two addresses only
 * when the person accepts one. A profile belongs to an account, which it names by its identifier; the person's address
 * is never shown. It reads the sender's organization from {@code organization}.
 */
@ApplicationModule(displayName = "Talent", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity", "notification", "organization" })
@NullMarked
package ai.genaifund.beyondpilot.talent;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
