package ai.genaifund.beyondpilot.messaging.dto;

import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.Min;
import org.jspecify.annotations.Nullable;

/** Which messages of a conversation to read. */
public record MessageListRequest(
		@Parameter(description = "Only the messages before the one with this seq, the latest of them.") @Min(1) @Nullable Long before,
		@Parameter(
				description = "Only the messages after the one with this seq, the earliest of them; it wins over before.") @Min(0) @Nullable Long after) {
}
