/**
 * The solutions that fit a use case, with the reasons a person can check: for each thing the use case asks for,
 * whether the solution's own material shows it, with the sentence that shows it and where that sentence is. A run
 * reads the use case's requirements, finds candidates in the index and has the model operators chose judge each one;
 * code checks every quote and decides the group. People then shortlist, remove and add candidates through
 * {@link ai.genaifund.beyondpilot.matching.MatchingService}; what they decide is never undone by a run. It reads only
 * what BeyondPilot holds. A run also judges the proposals a use case received against the same requirements, read
 * through {@link ai.genaifund.beyondpilot.proposal.UseCaseProposals#sentTo(java.util.UUID)} (BEY-229, ADR 0010).
 */
@ApplicationModule(displayName = "Matching", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "ai", "audit", "identity", "notification", "organization", "proposal", "search",
				"shared", "solution", "usecase" })
@NullMarked
package ai.genaifund.beyondpilot.matching;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
