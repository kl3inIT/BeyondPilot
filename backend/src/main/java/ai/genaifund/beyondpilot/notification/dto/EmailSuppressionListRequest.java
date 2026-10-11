package ai.genaifund.beyondpilot.notification.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the suppressed addresses, their order and which page is read. */
public record EmailSuppressionListRequest(
		@Parameter(description = "Only addresses suppressed for this reason.") @Pattern(regexp = "bounce|complaint|manual") @Nullable String reason,
		@Parameter(description = "Addresses that contain this, ignoring case.") @Size(max = 100) @Nullable String q,
		@Parameter(
				description = "The order: `address` alphabetically, `since` by when the address was suppressed; `-` "
						+ "before a key turns it round. Without it, the most recently suppressed first.",
				schema = @Schema(type = "string", allowableValues = { "address", "-address", "since",
						"-since" })) @Pattern(regexp = "-?(address|since)") @Nullable String sort,
		@Parameter(description = "The page, counted from 1.") @Min(1) @Nullable Integer page) {
}
