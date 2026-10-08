package ai.genaifund.beyondpilot.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveChatProvider",
		description = "A chat provider to connect or change. The address is an http or https URL; a saved key is kept only while it is unchanged.")
public record SaveChatProviderRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 60) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "openai", description = "One of the adapters the settings list.") @NotBlank @Size(max = 40) String adapterType,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "https://openrouter.ai/api/v1") @NotBlank @Size(max = 2048) String baseUrl,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "A provider switched off keeps its key and its models; no task can use it.") boolean enabled,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "keep", "replace", "remove" },
				description = "Keep the saved key, replace it with apiKey, or remove it. A new provider takes replace.") @NotNull @Pattern(regexp = "keep|replace|remove") String key,
		@Schema(types = { "string", "null" }, description = "The new key, with key = replace.") @Size(max = 8192) @Nullable String apiKey,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version the provider was read at; 0 for a new one.") long version) {

	@Override
	public String toString() {
		// A key must not reach a log through a record's generated text.
		return "SaveChatProviderRequest[" + name + ", key " + key + "]";
	}

}
