package ai.genaifund.beyondpilot.talent.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SentTalentEnquiry",
		description = "A message the caller sent through a talent profile, with what became of it.")
public record SentTalentEnquiryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The profile it was sent through; the caller's messages to one person share it.") UUID profileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String recipientName,
		@Schema(types = { "string", "null" }) @Nullable String recipientHeadline,
		@Schema(types = { "string", "null" },
				description = "The address of the profile's public page; null while the profile is not in the directory.") @Nullable String recipientSlug,
		@Schema(types = { "string", "null" },
				description = "Where the caller writes to the person; only once the person accepted.") @Nullable String recipientEmail,
		@Schema(types = { "string", "null" },
				description = "The name the caller signed it with; null on a message sent before a name was asked for.") @Nullable String senderName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "project", "role", "other" }) String topic,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "pending", "accepted", "declined", "closed" },
				description = "A message the person reported reads as declined.") String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the person answered it or it closed; null while it waits.") @Nullable Instant answeredAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When a waiting message closes unanswered; null once it is answered.") @Nullable Instant closesAt) {
}
