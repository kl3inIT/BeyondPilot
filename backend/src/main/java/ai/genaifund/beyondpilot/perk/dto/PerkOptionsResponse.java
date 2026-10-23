package ai.genaifund.beyondpilot.perk.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "PerkOptions",
		description = "What a perk's form chooses from: the giving organization's solutions and the programs.")
public record PerkOptionsResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Option> solutions, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Option> programs) {

	@Schema(name = "PerkOption", description = "One choice of a perk's form.")
	public record Option(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name) {
	}
}
