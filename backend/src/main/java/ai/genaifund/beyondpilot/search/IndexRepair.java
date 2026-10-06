package ai.genaifund.beyondpilot.search;

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

	IndexRepair(ProgramIndexing programs) {
		this.programs = programs;
	}

	@EventListener(ApplicationReadyEvent.class)
	@Scheduled(cron = "0 30 3 * * *", zone = "Asia/Ho_Chi_Minh")
	@Transactional
	void repair() {
		ProgramIndexing.Rebuilt rebuilt = programs.rebuild();
		LOG.atInfo()
			.addKeyValue("event", "search.index.repaired")
			.addKeyValue("programs_saved", rebuilt.saved())
			.addKeyValue("rows_removed", rebuilt.removed())
			.log("The search index was rebuilt from the published items");
	}

}
