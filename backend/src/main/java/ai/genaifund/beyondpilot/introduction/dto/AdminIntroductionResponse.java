package ai.genaifund.beyondpilot.introduction.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminIntroduction",
		description = "A request for an introduction as an operator reads it: the message in full, and no address.")
public record AdminIntroductionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The solution asked about, by the name it had then.") String solutionName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The organization that offers the solution and answers.") String providerOrganization,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The organization the sender asked as.") String senderOrganization,
		@Schema(description = "The sender's name; absent while they have not given one.") @Nullable String senderName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "pending", "replied", "declined" }) String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it has waited for an answer longer than three days.") boolean overdue,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(description = "When it was answered; absent while it waits.") @Nullable Instant answeredAt) {
}
