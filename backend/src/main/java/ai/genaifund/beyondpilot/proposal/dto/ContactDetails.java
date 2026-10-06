package ai.genaifund.beyondpilot.proposal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "ContactDetails",
		description = "How judges and GenAI Fund reach an applicant. Each part may be empty while the application is a draft.")
public record ContactDetails(@Schema(types = { "string", "null" }) @Size(max = 80) @Nullable String firstName,
		@Schema(types = { "string", "null" }) @Size(max = 80) @Nullable String lastName,
		@Schema(types = { "string", "null" }, description = "With its country code, such as +84 912 345 678.") @Size(
				max = 40) @Pattern(regexp = "^\\+?[0-9 ().-]*$") @Nullable String phone,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Pattern(
				regexp = "^[A-Z]{2}$") @Nullable String country,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Pattern(
				regexp = "^https://\\S+$") @Nullable String linkedin) {

	public static final ContactDetails EMPTY = new ContactDetails(null, null, null, null, null);
}
