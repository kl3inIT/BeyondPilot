/**
 * The talent profiles of people: what a person writes about themselves and submits, what GenAI Fund reviews, the
 * public directory of the approved ones. A profile belongs to an account, which it names by its identifier; the
 * person's address is never shown. It tells a person GenAI Fund's decision through {@code notification} and keeps
 * their photo in {@code storage}.
 */
@ApplicationModule(displayName = "Talent", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity", "notification", "storage", "shared" })
@NullMarked
package ai.genaifund.beyondpilot.talent;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
