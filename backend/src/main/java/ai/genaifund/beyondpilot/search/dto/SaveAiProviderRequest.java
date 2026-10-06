package ai.genaifund.beyondpilot.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/**
 * A provider as the editor holds it. A saved key is kept only while the address is unchanged, so a stored key never
 * goes to an address it was not given for.
 */
@Schema(name = "SaveAiProvider", description = "A provider to connect or change. A saved key is kept only while the address is unchanged.")
public record SaveAiProviderRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "openai", "openrouter" }) @NotNull @Pattern(regexp = "openai|openrouter") String vendor,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 60) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "https://openrouter.ai/api/v1") @NotBlank @Size(max = 200) String baseUrl,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "keep", "replace", "remove" },
				description = "Keep the saved key, replace it with apiKey, or remove it. A new provider takes replace.") @NotNull @Pattern(regexp = "keep|replace|remove") String key,
		@Schema(types = { "string", "null" }, description = "The new key, with key = replace.") @Size(max = 500) @Nullable String apiKey,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version the provider was read at; 0 for a new one.") long version) {
}
