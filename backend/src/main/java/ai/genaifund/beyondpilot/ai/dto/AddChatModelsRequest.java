package ai.genaifund.beyondpilot.ai.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

@Schema(name = "AddChatModels", description = "The models to enable on a provider, as ticked in its list.")
public record AddChatModelsRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotEmpty @Size(max = 100) List<@Valid SaveChatModelRequest> models) {
}
