package ai.genaifund.beyondpilot.proposal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SentBy", description = "The submitting identity: the account that sent the proposal, with the name, address, country and number it gave.")
public record SentByResponse(@Schema(types = { "string", "null" }) @Nullable String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
		@Schema(types = { "string", "null" }, description = "With its country code.") @Nullable String phone) {
}
