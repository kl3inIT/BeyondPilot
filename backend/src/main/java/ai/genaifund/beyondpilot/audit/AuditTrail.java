package ai.genaifund.beyondpilot.audit;

import java.time.Instant;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.persistence.AuditEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes audit events. An event belongs to the change it records: it is written in the transaction of the caller, so a
 * change that rolls back leaves no event, and an event that cannot be written fails the change.
 */
@Service
public class AuditTrail {

	private static final Logger LOG = LoggerFactory.getLogger(AuditTrail.class);

	/** The key under which the identifier of the request is logged; the event keeps it so the two can be joined. */
	private static final String REQUEST_ID = "request_id";

	private final AuditEventRepository events;

	AuditTrail(AuditEventRepository events) {
		this.events = events;
	}

	/**
	 * Records one event in the transaction of the change it describes.
	 * @throws org.springframework.transaction.IllegalTransactionStateException when no transaction is open
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public void record(AuditRecord record) {
		UUID id = UUID.randomUUID();
		AuditRecord.Actor actor = record.actor();
		events.insert(id, record, MDC.get(REQUEST_ID));
		// The line carries identifiers only; names and addresses stay in the table.
		LOG.atInfo()
			.addKeyValue("event", "audit.event.recorded")
			.addKeyValue("audit_event_id", id)
			.addKeyValue("action", record.action().value())
			.addKeyValue("actor_id", actor == null ? "configuration" : actor.id())
			.addKeyValue("resource_type", record.resource().type())
			.addKeyValue("resource_id", record.resource().id())
			.log("Audit event recorded");
	}

	/**
	 * How many events of one action an actor has recorded since a moment: what a limit on that action counts.
	 */
	@Transactional(readOnly = true)
	public long count(AuditAction action, UUID actorId, Instant since) {
		return events.count(action.value(), actorId, since);
	}

}
