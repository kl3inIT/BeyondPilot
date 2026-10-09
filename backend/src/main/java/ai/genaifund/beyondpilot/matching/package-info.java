/**
 * The solutions that fit a use case, with the reasons a person can check: for each thing the use case asks for,
 * whether the solution's own material shows it, with the sentence that shows it and where that sentence is. A run
 * reads the use case's requirements, finds candidates in the index and has the model operators chose judge each one;
 * code checks every quote and decides the group. It reads only what BeyondPilot holds.
 */
@ApplicationModule(displayName = "Matching", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "ai", "search", "solution", "usecase" })
@NullMarked
package ai.genaifund.beyondpilot.matching;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
