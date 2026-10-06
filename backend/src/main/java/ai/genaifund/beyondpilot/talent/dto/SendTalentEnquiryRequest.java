package ai.genaifund.beyondpilot.talent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "SendTalentEnquiry", description = "A message to the person behind a talent profile.")
public record SendTalentEnquiryRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "What the message is about.",
				allowableValues = { "project", "role", "other" }) @NotNull @Pattern(
						regexp = TalentCodes.ENQUIRY_TOPIC) String topic,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The name the person written to reads; never an address.") @NotBlank @Size(
						max = 120) String senderName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 2000) String message) {
}
