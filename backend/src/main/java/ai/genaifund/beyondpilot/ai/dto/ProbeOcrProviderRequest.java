package ai.genaifund.beyondpilot.ai.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProbeOcrProvider",
		description = "A connection to try, saved or not. Without an apiKey the saved key of providerId is used, while the address is the one it was saved with.")
public record ProbeOcrProviderRequest(
		@Schema(types = { "string", "null" }, format = "uuid", description = "The saved provider whose key to use when apiKey is empty.") @Nullable UUID providerId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "aihay") @NotBlank @Size(max = 40) String adapterType,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 2048) String baseUrl,
		@Schema(types = { "string", "null" }) @Size(max = 8192) @Nullable String apiKey) {

	@Override
	public String toString() {
		return "ProbeOcrProviderRequest[" + adapterType + "]";
	}

}
