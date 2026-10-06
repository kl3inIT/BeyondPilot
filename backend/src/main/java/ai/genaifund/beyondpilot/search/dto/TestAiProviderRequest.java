package ai.genaifund.beyondpilot.search.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "TestAiProvider",
		description = "A connection to try, saved or not. Without an apiKey the saved key of providerId is used, while the address is the one it was saved with.")
public record TestAiProviderRequest(
		@Schema(types = { "string", "null" }, format = "uuid", description = "The saved provider whose key to use when apiKey is empty.") @Nullable UUID providerId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "openai", "openrouter" }) @NotNull @Pattern(regexp = "openai|openrouter") String vendor,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 200) String baseUrl,
		@Schema(types = { "string", "null" }) @Size(max = 500) @Nullable String apiKey,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 100) String model) {
}
