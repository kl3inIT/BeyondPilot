package ai.genaifund.beyondpilot.identity.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "ContactRequest",
		description = "Where the person is and the number to reach them on. A part left out is cleared.")
public record ContactRequest(
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Pattern(
				regexp = "^[A-Z]{2}$") @Nullable String country,
		@Schema(types = { "string", "null" }, description = "With its country code, such as +84 912 345 678.") @Size(
				max = 40) @Pattern(regexp = "^\\+?[0-9 ().-]*$") @Nullable String phone) {
}
