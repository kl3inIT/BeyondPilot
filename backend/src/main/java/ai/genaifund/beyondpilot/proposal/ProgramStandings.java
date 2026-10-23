package ai.genaifund.beyondpilot.proposal;

import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.proposal.persistence.Proposal;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReleaseRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Where an organization stands in a program, for a module that gives something to a program's teams. */
@Service
public class ProgramStandings {

	private final ProposalRepository proposals;

	private final ProposalReleaseRepository releases;

	ProgramStandings(ProposalRepository proposals, ProposalReleaseRepository releases) {
		this.proposals = proposals;
		this.releases = releases;
	}

	/**
	 * The standing of an organization in a program, counting the applications its members sent for it and the ones the
	 * person sent before they belonged to it.
	 */
	@Transactional(readOnly = true)
	public ProgramStanding of(UUID programId, UUID organizationId, UUID accountId) {
		List<String> statuses = proposals.findSubmittedReviewStatuses(programId, organizationId, accountId);
		if (statuses.isEmpty()) {
			return ProgramStanding.NONE;
		}
		// The shortlist is internal until GenAI Fund releases the outcomes.
		return statuses.contains(Proposal.SHORTLISTED) && releases.existsById(programId) ? ProgramStanding.SHORTLISTED
				: ProgramStanding.APPLIED;
	}
}
