package ai.genaifund.beyondpilot.matching;

import ai.genaifund.beyondpilot.usecase.UseCaseChanged;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Queues a run when a use case is published or its brief changes. The use case is read again from its module, so a
 * late or repeated delivery queues what the use case is now, and at most one run waits for it.
 */
@Component
class UseCaseMatching {

	private final MatchingRuns runs;

	UseCaseMatching(MatchingRuns runs) {
		this.runs = runs;
	}

	@ApplicationModuleListener
	void on(UseCaseChanged changed) {
		runs.changed(changed.useCaseId());
	}

}
