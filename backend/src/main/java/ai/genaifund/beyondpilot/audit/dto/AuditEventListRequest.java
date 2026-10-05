package ai.genaifund.beyondpilot.audit.dto;

import java.time.Instant;

import ai.genaifund.beyondpilot.audit.AuditAction;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.springframework.format.annotation.DateTimeFormat;

/** What narrows the audit log and which page of it is read. Every member is optional. */
public record AuditEventListRequest(
		@Parameter(description = "Only events at or after this instant.") @DateTimeFormat(
				iso = DateTimeFormat.ISO.DATE_TIME) @Nullable Instant from,
		@Parameter(description = "Only events of this action.") @Nullable AuditAction action,
		@Parameter(
				description = "Events whose actor's name or address, or whose resource's name, contains this, ignoring case.") @Size(
						max = 100) @Nullable String q,
		@Parameter(description = "The `older` cursor of a page: the events before it. Used when both cursors are given.") @Pattern(
				regexp = CURSOR) @Nullable String before,
		@Parameter(description = "The `newer` cursor of a page: the events after it.") @Pattern(
				regexp = CURSOR) @Nullable String after) {

	/** Microseconds since the epoch and the event's identifier: the place of one event in the order of the log. */
	static final String CURSOR = "\\d{1,18}_[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}";

}
