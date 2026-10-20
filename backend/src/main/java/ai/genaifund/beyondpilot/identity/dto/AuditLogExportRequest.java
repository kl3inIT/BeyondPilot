package ai.genaifund.beyondpilot.identity.dto;

import java.time.Instant;
import java.util.List;

import ai.genaifund.beyondpilot.audit.AuditAction;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.springframework.format.annotation.DateTimeFormat;

/** What narrows the audit log a download holds: the audit log's own filters. Every member is optional but the format. */
public record AuditLogExportRequest(
		@Parameter(description = "Only events at or after this instant.") @DateTimeFormat(
				iso = DateTimeFormat.ISO.DATE_TIME) @Nullable Instant from,
		@Parameter(description = "Only events of this action.") @Nullable AuditAction action,
		@Parameter(
				description = "Events whose actor's name or address, or whose resource's name, contains this, ignoring case; with `actions`, the events of those actions too.") @Size(
						max = 100) @Nullable String q,
		@Parameter(description = "Actions whose names the search matches, in the reader's language: an event of one of them matches the search as well as one whose people or resource match `q`.") @Size(
				max = 300) @Nullable List<AuditAction> actions,
		@Parameter(description = "The file: xlsx, an Excel workbook to read, or csv for another tool.",
				schema = @Schema(allowableValues = { "xlsx", "csv" }, defaultValue = "xlsx")) @Pattern(
						regexp = "xlsx|csv") @Nullable String format) {
}
