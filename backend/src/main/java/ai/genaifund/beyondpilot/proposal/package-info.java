/**
 * Applications to programs: a person's working copy, its submissions as versions that keep what they were given, and
 * withdrawing. Taking part never waits for GenAI Fund's review of the applicant's organization or solution; that
 * review decides what is listed (BEY-37). The proposals organizations send to use cases (BEY-133): one working copy for
 * each organization and use case that its members share, sent with the sender's talent profile kept as it was, and read
 * by the members of the organization that posted the use case. The review of a program's applications: its criteria and judges, the
 * assessments, GenAI Fund's decisions and the release of the outcomes (BEY-38).
 */
@ApplicationModule(displayName = "Proposal", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "identity", "program", "organization", "solution", "storage", "notification", "audit",
			"usecase" })
@NullMarked
package ai.genaifund.beyondpilot.proposal;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
