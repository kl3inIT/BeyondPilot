package ai.genaifund.beyondpilot.search;

import java.time.Instant;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Makes the index agree with what the owning modules publish, whatever deliveries were missed: when the application
 * starts, which also fills the index the first time, and every night. Events keep the index current in between.
 */
@Component
@EnableScheduling
class IndexRepair {

	private static final Logger LOG = LoggerFactory.getLogger(IndexRepair.class);

	private final ProgramIndexing programs;

	private final SolutionIndexing solutions;

	private final TalentIndexing talent;

	private final UseCaseIndexing useCases;

	private volatile @Nullable Run lastRun;

	IndexRepair(ProgramIndexing programs, SolutionIndexing solutions, TalentIndexing talent,
			UseCaseIndexing useCases) {
		this.programs = programs;
		this.solutions = solutions;
		this.talent = talent;
		this.useCases = useCases;
	}

	@EventListener(ApplicationReadyEvent.class)
	@Scheduled(cron = "0 30 3 * * *", zone = "Asia/Ho_Chi_Minh")
	@Transactional
	synchronized void repair() {
		rebuild();
	}

	/** Rebuilds the index now, as an operator asked; one rebuild runs at a time. */
	@Transactional
	synchronized Run rebuildNow() {
		return rebuild();
	}

	private Run rebuild() {
		Rebuilt programs = this.programs.rebuild();
		Rebuilt solutions = this.solutions.rebuild();
		Rebuilt talent = this.talent.rebuild();
		Rebuilt useCases = this.useCases.rebuild();
		LOG.atInfo()
			.addKeyValue("event", "search.index.repaired")
			.addKeyValue("programs_saved", programs.saved())
			.addKeyValue("solutions_saved", solutions.saved())
			.addKeyValue("talent_saved", talent.saved())
			.addKeyValue("use_cases_saved", useCases.saved())
			.addKeyValue("rows_removed", programs.removed() + solutions.removed() + talent.removed() + useCases.removed())
			.log("The search index was rebuilt from the published items");
		Run run = new Run(Instant.now(), programs.saved() + solutions.saved() + talent.saved() + useCases.saved(),
				programs.removed() + solutions.removed() + talent.removed() + useCases.removed());
		lastRun = run;
		return run;
	}

	/** The last rebuild since the application started, or null before the first. */
	@Nullable Run lastRun() {
		return lastRun;
	}

	/** When a rebuild ran, how many items it saved and how many rows it took out. */
	record Run(Instant at, int saved, int removed) {
	}

}
