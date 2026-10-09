package ai.genaifund.beyondpilot.ai.dto;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveChatModel", description = "A model to enable or correct. Prices are US dollars per million tokens; null is unknown.")
public record SaveChatModelRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The name the provider knows it by.") @NotBlank @Size(max = 200) String modelName,
		@Schema(types = { "string", "null" }, description = "The name shown; the model name when empty.") @Size(max = 200) @Nullable String displayName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @Min(256) @Max(10_000_000) int contextWindow,
		@Schema(types = { "integer", "null" }) @Min(1) @Nullable Integer maxOutputTokens,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean toolCalling,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean vision,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean reasoning,
		@Schema(types = { "number", "null" }) @DecimalMin("0") @DecimalMax("100000") @Nullable BigDecimal inputPrice,
		@Schema(types = { "number", "null" }) @DecimalMin("0") @DecimalMax("100000") @Nullable BigDecimal outputPrice,
		@Schema(types = { "number", "null" }) @DecimalMin("0") @DecimalMax("100000") @Nullable BigDecimal cachedInputPrice,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version the model was read at; 0 for a new one.") long version) {
}
