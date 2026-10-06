package ai.genaifund.beyondpilot.talent.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminTalentEnquiry", description = "A message the person behind a talent profile reported as unwanted.")
public record AdminTalentEnquiryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The profile it was sent through.") UUID profileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String profileName,
		@Schema(types = { "string", "null" },
				description = "The sender's name; null when they gave none.") @Nullable String senderName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The sender's address; empty when the account no longer signs in.") String senderEmail,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "project", "role", "other" }) String topic,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When it was reported.") @Nullable Instant reportedAt) {
}
