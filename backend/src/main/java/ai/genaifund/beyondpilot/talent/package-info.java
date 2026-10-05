/**
 * The talent profiles of people: what a person writes about themselves and submits, what GenAI Fund reviews, the
 * public directory of the approved ones, and the messages sent through a profile. A profile belongs to an account,
 * which it names by its identifier; the person's address is never shown.
 */
@ApplicationModule(displayName = "Talent", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity", "notification" })
@NullMarked
package ai.genaifund.beyondpilot.talent;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
