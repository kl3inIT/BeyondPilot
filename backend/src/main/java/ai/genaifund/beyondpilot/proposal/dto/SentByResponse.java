package ai.genaifund.beyondpilot.proposal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SentBy", description = "The account that sent the proposal, as shown with it when no talent profile goes with it.")
public record SentByResponse(@Schema(types = { "string", "null" }) @Nullable String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email) {
}
