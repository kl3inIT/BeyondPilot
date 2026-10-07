/**
 * Search over what BeyondPilot publishes: programs, solutions, talent and use cases, found by their words, their
 * unaccented forms, the start of a word, typos, and by meaning with the embedding provider operators connect in
 * Admin › AI. The index is a projection of the owning modules, which stay the source of truth.
 */
@ApplicationModule(displayName = "Search", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "audit", "identity", "organization", "program", "solution", "talent", "usecase" })
@NullMarked
package ai.genaifund.beyondpilot.search;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
