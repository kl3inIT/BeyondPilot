package ai.genaifund.beyondpilot.identity.oauth;

import java.time.Duration;
import java.time.Instant;

import ai.genaifund.beyondpilot.identity.persistence.OAuthTableRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Deletes, once a day, the connections no token of which works any more. */
@Component
class ExpiredConnections {

	private static final Logger LOG = LoggerFactory.getLogger(ExpiredConnections.class);

	private final OAuthTableRepository tables;

	ExpiredConnections(OAuthTableRepository tables) {
		this.tables = tables;
	}

	@Scheduled(cron = "0 15 4 * * *", zone = "Asia/Ho_Chi_Minh")
	void delete() {
		int deleted = tables.deleteExpired(Instant.now().minus(Duration.ofDays(1)));
		LOG.atInfo()
			.addKeyValue("event", "identity.oauth.expired_connections_deleted")
			.addKeyValue("rows", deleted)
			.log("Expired AI app connections were deleted");
	}

}
