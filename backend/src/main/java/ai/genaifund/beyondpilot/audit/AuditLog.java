package ai.genaifund.beyondpilot.audit;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.dto.AuditEventListRequest;
import ai.genaifund.beyondpilot.audit.dto.AuditEventListResponse;
import ai.genaifund.beyondpilot.audit.dto.AuditEventResponse;
import ai.genaifund.beyondpilot.audit.persistence.AuditEventQueryRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads the audit log, newest first, a page at a time. The log only grows, so a page is named by the event at its edge
 * and not by a number: a page keeps its events while new ones are recorded.
 *
 * <p>
 * It takes no caller. This module depends on no other and so cannot ask who is an operator; the filter chain lets
 * only operators reach {@code /api/audit/**} (ADR 0004). A module that calls this directly answers for who reads.
 */
@Service
public class AuditLog {

	static final int PAGE_SIZE = 50;

	private final AuditEventQueryRepository events;

	AuditLog(AuditEventQueryRepository events) {
		this.events = events;
	}

	/** One page of the events the request selects. */
	@Transactional(readOnly = true)
	public AuditEventListResponse list(AuditEventListRequest request) {
		String text = request.q() == null || request.q().isBlank() ? null : request.q().strip();
		if (request.before() == null && request.after() != null) {
			return towardsThePresent(request, text, Place.of(request.after()));
		}
		Place place = request.before() == null ? null : Place.of(request.before());
		// One more than a page tells whether an older page exists.
		List<AuditEventResponse> found = events.older(request.from(), request.action(), text,
				place == null ? null : place.at(), place == null ? null : place.id(), PAGE_SIZE + 1);
		List<AuditEventResponse> page = found.subList(0, Math.min(found.size(), PAGE_SIZE));
		return new AuditEventListResponse(page, place == null || page.isEmpty() ? null : cursor(page.getFirst()),
				found.size() > PAGE_SIZE ? cursor(page.getLast()) : null);
	}

	private AuditEventListResponse towardsThePresent(AuditEventListRequest request, @Nullable String text, Place place) {
		List<AuditEventResponse> found = events.newer(request.from(), request.action(), text, place.at(), place.id(),
				PAGE_SIZE + 1);
		List<AuditEventResponse> page = found.subList(0, Math.min(found.size(), PAGE_SIZE)).reversed();
		return new AuditEventListResponse(page, found.size() > PAGE_SIZE ? cursor(page.getFirst()) : null,
				page.isEmpty() ? null : cursor(page.getLast()));
	}

	private static String cursor(AuditEventResponse event) {
		return ChronoUnit.MICROS.between(Instant.EPOCH, event.occurredAt()) + "_" + event.id();
	}

	/** Where an event stands in the order of the log. The request has already checked the cursor's form. */
	private record Place(Instant at, UUID id) {

		static Place of(String cursor) {
			int cut = cursor.indexOf('_');
			return new Place(Instant.EPOCH.plus(Long.parseLong(cursor, 0, cut, 10), ChronoUnit.MICROS),
					UUID.fromString(cursor.substring(cut + 1)));
		}

	}

}
