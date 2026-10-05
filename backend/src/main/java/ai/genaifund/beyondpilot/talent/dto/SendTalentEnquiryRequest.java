package ai.genaifund.beyondpilot.talent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "SendTalentEnquiry", description = "A message to the person behind a talent profile.")
public record SendTalentEnquiryRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 2000) String message) {
}
