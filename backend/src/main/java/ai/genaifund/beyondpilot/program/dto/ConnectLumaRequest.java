package ai.genaifund.beyondpilot.program.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "ConnectLuma", description = "The API key of a Luma calendar, made in its Settings › Developer.")
public record ConnectLumaRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 200) String apiKey) {
}
