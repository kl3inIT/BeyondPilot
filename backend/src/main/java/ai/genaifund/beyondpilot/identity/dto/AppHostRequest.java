package ai.genaifund.beyondpilot.identity.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "AppHostRequest", description = "A host whose apps BeyondPilot has reviewed.")
public record AppHostRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
		example = "app.example.com") @NotBlank @Size(max = 253) String host) {
}
