package ai.genaifund.beyondpilot.identity.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the operators' list of accounts. Every member is optional. */
public record AccountListRequest(
		@Parameter(description = "Accounts whose name or address contains this, ignoring case.") @Size(
				max = 100) @Nullable String q,
		@Parameter(description = "Only accounts of this status.",
				schema = @Schema(allowableValues = { "active", "disabled" })) @Pattern(
						regexp = "active|disabled") @Nullable String status,
		@Parameter(description = "Only accounts of this role.",
				schema = @Schema(allowableValues = { "user", "operator" })) @Pattern(
						regexp = "user|operator") @Nullable String role,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page) {
}
