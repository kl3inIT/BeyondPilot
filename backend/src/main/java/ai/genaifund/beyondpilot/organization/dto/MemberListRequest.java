package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.jspecify.annotations.Nullable;

/** The order of the members and which page of them to read. */
public record MemberListRequest(
		@Parameter(
				description = "The order: `role` owners before members, `joined` by when the person joined; `-` before "
						+ "a key turns it round. Without it, owners first, then in the order they joined.",
				schema = @Schema(type = "string", allowableValues = { "role", "-role", "joined",
						"-joined" })) @Pattern(regexp = "-?(role|joined)") @Nullable String sort,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page,
		@Parameter(description = "How many items a page holds; the list's own page size when absent.",
				schema = @Schema(type = "integer", format = "int32", minimum = "1", maximum = "100")) @Min(1) @Max(
						100) @Nullable Integer size) {
}
