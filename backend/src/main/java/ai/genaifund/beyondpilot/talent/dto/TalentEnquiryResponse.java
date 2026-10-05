package ai.genaifund.beyondpilot.talent.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "TalentEnquiry", description = "A message someone sent through the caller's talent profile.")
public record TalentEnquiryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Who wrote it, as they are shown.") String senderName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Where the caller answers them.") String senderEmail,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {
}
