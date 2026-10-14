package ai.genaifund.beyondpilot.audit;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.dto.AuditEventListRequest;
import ai.genaifund.beyondpilot.audit.dto.AuditEventListResponse;
import ai.genaifund.beyondpilot.audit.dto.AuditEventResponse;
import ai.genaifund.beyondpilot.audit.persistence.AuditEventQueryRepository;
import ai.genaifund.beyondpilot.shared.Spreadsheet;
import ai.genaifund.beyondpilot.shared.SpreadsheetFile;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import java.util.ArrayList;
import java.util.Map;
import java.util.stream.Collectors;
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
		int size = request.size() == null ? PAGE_SIZE : request.size();
		if (request.before() == null && request.after() != null) {
			return towardsThePresent(request, text, Place.of(request.after()), size);
		}
		Place place = request.before() == null ? null : Place.of(request.before());
		// One more than a page tells whether an older page exists.
		List<AuditEventResponse> found = events.older(request.from(), request.action(), text,
				place == null ? null : place.at(), place == null ? null : place.id(), size + 1);
		List<AuditEventResponse> page = found.subList(0, Math.min(found.size(), size));
		return new AuditEventListResponse(page, place == null || page.isEmpty() ? null : cursor(page.getFirst()),
				found.size() > size ? cursor(page.getLast()) : null);
	}

	/**
	 * Every event the filters select, newest first, as a spreadsheet. Like {@link #list}, it takes no caller: the
	 * module that calls it answers for who reads, and records the download.
	 * @param downloadedBy the operator who downloads it, named on the file's About sheet
	 * @throws ai.genaifund.beyondpilot.shared.SpreadsheetException when the download would hold too many rows
	 */
	@Transactional(readOnly = true)
	public SpreadsheetFile spreadsheet(@Nullable Instant from, @Nullable AuditAction action, @Nullable String q,
			SpreadsheetFormat format, String downloadedBy) {
		List<AuditEventResponse> rows = new ArrayList<>();
		String before = null;
		do {
			AuditEventListResponse page = list(new AuditEventListRequest(from, action, q, before, null,
					Spreadsheet.PAGE_SIZE));
			rows.addAll(page.items());
			Spreadsheet.bounded(rows.size());
			before = page.older();
		}
		while (before != null);
		Spreadsheet<AuditEventResponse> sheet = Spreadsheet.<AuditEventResponse>of("Audit log")
			.time("Time", AuditEventResponse::occurredAt)
			.text("Action", event -> event.action().value())
			.group("Who")
			.text("Name", event -> event.actor() == null ? "The server's configuration" : event.actor().label())
			.email("Email", event -> event.actor() == null ? null : event.actor().email())
			.group("What")
			.label("Kind", event -> event.resource().type())
			.text("Name", event -> event.resource().label())
			.text("Identifier", event -> event.resource().id())
			.ungrouped()
			.paragraph("Details",
					event -> event.details()
						.entrySet()
						.stream()
						.sorted(Map.Entry.comparingByKey())
						.map(detail -> detail.getKey() + ": " + detail.getValue())
						.collect(Collectors.joining("\n")))
			.text("Request", AuditEventResponse::requestId);
		return sheet.write(format, "audit-log", rows,
				Spreadsheet.About.of(downloadedBy, Instant.now())
					.narrowedBy("From", from)
					.narrowedBy("Action", action == null ? null : action.value())
					.narrowedBy("Search", q));
	}

	private AuditEventListResponse towardsThePresent(AuditEventListRequest request, @Nullable String text, Place place,
			int size) {
		List<AuditEventResponse> found = events.newer(request.from(), request.action(), text, place.at(), place.id(),
				size + 1);
		List<AuditEventResponse> page = found.subList(0, Math.min(found.size(), size)).reversed();
		return new AuditEventListResponse(page, found.size() > size ? cursor(page.getFirst()) : null,
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
