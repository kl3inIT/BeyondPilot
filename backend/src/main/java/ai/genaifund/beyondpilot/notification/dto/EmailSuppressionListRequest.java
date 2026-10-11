package ai.genaifund.beyondpilot.notification.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the suppressed addresses and which page is read. */
public record EmailSuppressionListRequest(
		@Parameter(description = "Only addresses suppressed for this reason.") @Pattern(regexp = "bounce|complaint|manual") @Nullable String reason,
		@Parameter(description = "Addresses that contain this, ignoring case.") @Size(max = 100) @Nullable String q,
		@Parameter(description = "The page, counted from 1.") @Min(1) @Nullable Integer page,
		@Parameter(description = "How many items a page holds; the list's own page size when absent.",
				schema = @Schema(type = "integer", format = "int32", minimum = "1", maximum = "100")) @Min(1) @Max(
						100) @Nullable Integer size) {
}
