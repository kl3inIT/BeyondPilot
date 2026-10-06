/**
 * Applications to programs: a person's working copy, its submissions as versions that keep what they were given, and
 * withdrawing. Taking part never waits for GenAI Fund's review of the applicant's organization or solution; that
 * review decides what is listed (BEY-37).
 */
@ApplicationModule(displayName = "Proposal", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "identity", "program", "organization", "solution", "storage", "notification" })
@NullMarked
package ai.genaifund.beyondpilot.proposal;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
