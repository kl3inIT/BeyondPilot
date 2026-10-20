package ai.genaifund.beyondpilot.matching;

import ai.genaifund.beyondpilot.proposal.ProposalSubmitted;
import ai.genaifund.beyondpilot.proposal.UseCaseProposalSent;
import ai.genaifund.beyondpilot.usecase.UseCaseChanged;
import ai.genaifund.beyondpilot.usecase.UseCaseDirectory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Queues an evaluation run of a program when something it reads changes (BEY-234): an application submitted to the
 * program, a proposal sent or edited to one of its use cases, or one of its use cases changed. What changed is read
 * again when the run starts, so a late or repeated delivery queues what the program holds then, and at most one run
 * waits for it.
 */
@Component
class ProgramEvaluation {

	private final EvaluationRuns runs;

	private final UseCaseDirectory useCases;

	ProgramEvaluation(EvaluationRuns runs, UseCaseDirectory useCases) {
		this.runs = runs;
		this.useCases = useCases;
	}

	@ApplicationModuleListener
	void on(ProposalSubmitted submitted) {
		runs.changed(submitted.programId());
	}

	@ApplicationModuleListener
	void on(UseCaseProposalSent sent) {
		useCases.programsOf(sent.useCaseId()).forEach(runs::changed);
	}

	@ApplicationModuleListener
	void on(UseCaseChanged changed) {
		useCases.programsOf(changed.useCaseId()).forEach(runs::changed);
	}

}
