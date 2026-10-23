package ai.genaifund.beyondpilot.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SearchPerk", description = "An open perk a solution in the results goes with.")
public record SearchPerk(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Its address, /solutions/perks/{slug}.") String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(types = { "string", "null" }, description = "The figure its card shows, such as $1,000.") @Nullable String value,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True when GenAI Fund arranged it.") boolean fromGenAiFund) {
}
