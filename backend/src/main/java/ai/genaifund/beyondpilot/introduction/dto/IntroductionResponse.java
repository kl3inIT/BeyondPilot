package ai.genaifund.beyondpilot.introduction.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Introduction", description = "A request for an introduction to the caller's organization.")
public record IntroductionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The solution the sender asked about, by the name it had then.") String solutionName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The organization the sender asked as.") String senderOrganization,
		@Schema(description = "The sender's name; absent while the sender has not given one.") @Nullable String senderName,
		@Schema(description = "The sender's address, shown only once the request was replied to.") @Nullable String senderEmail,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "pending", "replied", "declined" }) String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(description = "When it was answered; absent while it waits.") @Nullable Instant answeredAt) {
}
