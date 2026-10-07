package ai.genaifund.beyondpilot.notification.delivery;

import ai.genaifund.beyondpilot.notification.persistence.EmailEventRepository;
import ai.genaifund.beyondpilot.notification.persistence.EmailSuppressionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Applies what providers report about sent email. A report is recorded once, moves the message's status forward, and
 * a permanent bounce or a complaint suppresses the address (listmonk's rules: one of either is enough). A report about
 * a message BeyondPilot does not know, such as one sent by another application on the same account, is ignored.
 */
@Component
public class DeliveryReports {

	private static final Logger LOG = LoggerFactory.getLogger(DeliveryReports.class);

	private final EmailEventRepository events;

	private final EmailSuppressionRepository suppressions;

	DeliveryReports(EmailEventRepository events, EmailSuppressionRepository suppressions) {
		this.events = events;
		this.suppressions = suppressions;
	}

	@Transactional
	public void apply(DeliveryReport report) {
		var message = events.message(report.provider().value(), report.providerMessageId());
		if (message.isEmpty()) {
			LOG.atDebug()
				.addKeyValue("event", "notification.email.report_unknown")
				.addKeyValue("provider", report.provider().value())
				.log("A report names no message of BeyondPilot");
			return;
		}
		var reported = message.get();
		if (!events.record(reported.id(), report.type().value(), report.occurredAt(), report.detail(),
				report.sourceId())) {
			return;
		}
		switch (report.type()) {
			case DELIVERED -> events.advance(reported.id(), "delivered");
			case BOUNCED -> {
				events.advance(reported.id(), "bounced");
				suppressions.add(reported.recipient(), "bounce", reported.id(), null, null);
			}
			case COMPLAINED -> {
				events.advance(reported.id(), "complained");
				suppressions.add(reported.recipient(), "complaint", reported.id(), null, null);
			}
			case SOFT_BOUNCED -> {
			}
		}
		LOG.atInfo()
			.addKeyValue("event", "notification.email.reported")
			.addKeyValue("email_id", reported.id())
			.addKeyValue("provider", report.provider().value())
			.addKeyValue("report", report.type().value())
			.log("A provider reported on an email");
	}

}
