package ai.genaifund.beyondpilot.messaging.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;

/** How far the caller has read a conversation. */
public record MarkReadRequest(
		@Schema(description = "The seq of the last message the caller has read.") @Min(1) long seq) {
}
