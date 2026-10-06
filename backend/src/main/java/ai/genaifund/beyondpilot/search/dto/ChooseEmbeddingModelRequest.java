package ai.genaifund.beyondpilot.search.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(name = "ChooseEmbeddingModel", description = "The provider and model search embeds with from now on. Every item is embedded again when the model changes.")
public record ChooseEmbeddingModelRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull UUID providerId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 100) String model,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version of the search settings it was read at.") long version) {
}
