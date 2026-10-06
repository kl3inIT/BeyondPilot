package ai.genaifund.beyondpilot.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SetSemanticSearch", description = "Turns semantic search on or off. Off, search matches keywords only and nothing is sent to the provider.")
public record SetSemanticSearchRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean enabled,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version of the search settings it was read at.") long version) {
}
