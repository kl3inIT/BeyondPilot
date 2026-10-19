package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * An application not submitted yet, as it stands now, for a module that reports it to an operator: the MCP server's
 * {@code get_application} when it names a draft. A part the applicant has not written yet is empty.
 * @param organization null until the applicant has one
 * @param solution the solution chosen, with what the draft adds to it; its name is empty until one is chosen
 */
public record DraftApplication(UUID id, SubmittedApplication.Program program, Instant startedAt,
		Instant lastSavedAt, SubmittedApplication.Applicant applicant,
		SubmittedApplication.@Nullable Organization organization, SubmittedApplication.Solution solution,
		List<SubmittedApplication.Answer> answers) {
}
