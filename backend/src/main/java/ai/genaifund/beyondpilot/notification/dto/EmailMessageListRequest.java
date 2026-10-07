package ai.genaifund.beyondpilot.notification.dto;

import java.time.Instant;

import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.springframework.format.annotation.DateTimeFormat;

/** What narrows the email log and which page of it is read. Every member is optional. */
public record EmailMessageListRequest(
		@Parameter(description = "Only emails queued at or after this instant; the counts cover the same period.") @DateTimeFormat(
				iso = DateTimeFormat.ISO.DATE_TIME) @Nullable Instant from,
		@Parameter(description = "Only emails of this kind.") @Pattern(regexp = "[a-z_]{1,40}") @Nullable String kind,
		@Parameter(description = "Only emails in this state.") @Pattern(
				regexp = "queued|sent|delivered|bounced|complained|failed|skipped") @Nullable String status,
		@Parameter(description = "Emails whose recipient or subject contains this, ignoring case.") @Size(max = 100) @Nullable String q,
		@Parameter(description = "The `older` cursor of a page: the emails before it.") @Pattern(regexp = CURSOR) @Nullable String before,
		@Parameter(description = "The `newer` cursor of a page: the emails after it.") @Pattern(regexp = CURSOR) @Nullable String after) {

	/** Microseconds since the epoch and the message's identifier. */
	public static final String CURSOR = "\\d{1,18}_[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}";

}
