package ai.genaifund.beyondpilot.notification.dto;

import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the suppressed addresses and which page is read. */
public record EmailSuppressionListRequest(
		@Parameter(description = "Only addresses suppressed for this reason.") @Pattern(regexp = "bounce|complaint|manual") @Nullable String reason,
		@Parameter(description = "Addresses that contain this, ignoring case.") @Size(max = 100) @Nullable String q,
		@Parameter(description = "The page, counted from 1.") @Min(1) @Nullable Integer page) {
}
