package ai.genaifund.beyondpilot.talent.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "TalentEnquiry", description = "A message someone sent through the caller's talent profile.")
public record TalentEnquiryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(types = { "string", "null" },
				description = "Who wrote it, by the name they gave; null when they gave none and the caller has not accepted.") @Nullable String senderName,
		@Schema(types = { "string", "null" },
				description = "The organization the sender belonged to when they wrote; null when none.") @Nullable String senderOrganization,
		@Schema(types = { "string", "null" },
				description = "Where the caller writes to the sender; only once the caller accepted.") @Nullable String senderEmail,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "project", "role", "other" }) String topic,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "pending", "accepted", "declined", "reported", "closed" }) String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the caller answered it or it closed; null while it waits.") @Nullable Instant answeredAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When a waiting message closes unanswered; null once it is answered.") @Nullable Instant closesAt) {
}
