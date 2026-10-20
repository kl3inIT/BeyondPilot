package ai.genaifund.beyondpilot.matching;

import ai.genaifund.beyondpilot.proposal.UseCaseProposalSent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Queues a run when a proposal to a use case is sent or edited, so that its evaluation follows what it says (BEY-229).
 * The proposals are read again when the run reaches them, so a late or repeated delivery judges what they are then, and
 * at most one run waits for the use case.
 */
@Component
class ProposalMatching {

	private final MatchingRuns runs;

	ProposalMatching(MatchingRuns runs) {
		this.runs = runs;
	}

	@ApplicationModuleListener
	void on(UseCaseProposalSent sent) {
		runs.proposalSent(sent.useCaseId());
	}

}
