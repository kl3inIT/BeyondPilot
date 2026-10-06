/**
 * The AI solutions organizations offer: what an owner writes and submits, what GenAI Fund reviews, and the public
 * directory of the approved ones. A solution belongs to an organization, which it names by its identifier. Its deck is
 * a stored file it names the same way.
 */
@ApplicationModule(displayName = "Solution", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity", "organization", "storage" })
@NullMarked
package ai.genaifund.beyondpilot.solution;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
