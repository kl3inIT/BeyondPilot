package ai.genaifund.beyondpilot.solution.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminOffer", description = "An offer as an operator reads it: GenAI Fund's, or an organization's own.")
public record AdminOfferResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String url,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The organization that wrote it; null for an offer of GenAI Fund's list.") @Nullable UUID organizationId,
		@Schema(types = { "string", "null" },
				description = "The name of that organization; null for an offer of GenAI Fund's list.") @Nullable String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many solutions come with it; it is deleted only when none does.") int solutions,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Sent back with a save, which is refused when the offer changed since.") long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {
}
