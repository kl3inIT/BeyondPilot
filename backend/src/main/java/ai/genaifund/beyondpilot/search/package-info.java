/**
 * Search over what BeyondPilot publishes: programs, solutions and talent, found by their words, their unaccented forms,
 * the start of a word and typos. The index is a projection of the owning modules, which stay the source of truth.
 */
@ApplicationModule(displayName = "Search", type = ApplicationModule.Type.CLOSED, allowedDependencies = { "program" })
@NullMarked
package ai.genaifund.beyondpilot.search;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
