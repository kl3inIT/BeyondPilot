package ai.genaifund.beyondpilot.ai.dto;

import java.math.BigDecimal;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ReportedChatModels", description = "The models a provider lists, with what it and the bundled catalog know about each.")
public record ReportedChatModelsResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Model> models) {

	@Schema(name = "ReportedChatModel")
	public record Model(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String modelName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int contextWindow,
			@Schema(types = { "integer", "null" }) @Nullable Integer maxOutputTokens,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean toolCalling,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean vision,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean reasoning,
			@Schema(types = { "number", "null" }, description = "US dollars per million tokens.") @Nullable BigDecimal inputPrice,
			@Schema(types = { "number", "null" }) @Nullable BigDecimal outputPrice,
			@Schema(types = { "number", "null" }) @Nullable BigDecimal cachedInputPrice,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "provider", "catalog", "none" },
					description = "Where the context window came from; none means a default was assumed.") String source,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether the saved provider already has this model.") boolean configured) {
	}

}
