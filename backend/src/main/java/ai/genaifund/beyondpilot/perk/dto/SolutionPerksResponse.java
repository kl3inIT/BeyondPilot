package ai.genaifund.beyondpilot.perk.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SolutionPerks", description = "The open perks a solution goes with, as its card shows them.")
public record SolutionPerksResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The solution's address.") String slug, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Line> perks) {

	@Schema(name = "SolutionPerkLine", description = "One perk on a solution's card.")
	public record Line(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
			@Schema(types = { "string", "null" }) @Nullable String value, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean fromGenAiFund) {
	}
}
