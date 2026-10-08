package ai.genaifund.beyondpilot.ai;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import ai.genaifund.beyondpilot.ai.adapter.ReportedModel;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * What is publicly known about models by name: limits, capabilities and prices, from the list bundled at
 * {@code ai/known-models.json} (MemoryOS's, taken from LiteLLM's public price list). It fills what a provider's own
 * list leaves out: OpenAI names its models only, and Anthropic and 9Router publish no price.
 */
@Component
class KnownModels {

	private final List<Known> models;

	KnownModels() {
		try (InputStream json = new ClassPathResource("ai/known-models.json").getInputStream()) {
			List<Known> read = new ArrayList<>();
			for (JsonNode model : JsonMapper.builder().build().readTree(json).path("models")) {
				read.add(new Known(model.path("modelName").asString(), model.path("contextWindow").asInt(),
						model.path("maxOutputTokens").asInt(), flag(model, "toolCalling"), flag(model, "vision"),
						flag(model, "reasoning"), price(model, "inputPerMillion"), price(model, "outputPerMillion"),
						price(model, "cachedInputPerMillion")));
			}
			this.models = List.copyOf(read);
		}
		catch (IOException unreadable) {
			throw new UncheckedIOException(unreadable);
		}
	}

	/** Catalog names are bare ({@code gpt-5-mini}); endpoints may prefix them ({@code openai/gpt-5-mini}). */
	Optional<Known> find(String reported) {
		String name = reported.startsWith("models/") ? reported.substring("models/".length()) : reported;
		for (String candidate : List.of(name, name.substring(name.lastIndexOf('/') + 1))) {
			for (Known model : models) {
				if (model.modelName().equals(candidate)) {
					return Optional.of(model);
				}
			}
		}
		return Optional.empty();
	}

	private static boolean flag(JsonNode model, String field) {
		return model.path(field).asBoolean(false);
	}

	private static @Nullable BigDecimal price(JsonNode model, String field) {
		JsonNode value = model.path(field);
		return value.isNumber() ? value.decimalValue() : null;
	}

	record Known(String modelName, int contextWindow, int maxOutputTokens, boolean toolCalling, boolean vision,
			boolean reasoning, @Nullable BigDecimal inputPrice, @Nullable BigDecimal outputPrice,
			@Nullable BigDecimal cachedInputPrice) {

		ReportedModel.@Nullable Pricing pricing() {
			return inputPrice == null || outputPrice == null ? null
					: new ReportedModel.Pricing(inputPrice, outputPrice, cachedInputPrice);
		}

	}

}
