package ai.genaifund.beyondpilot.ai.adapter;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import ai.genaifund.beyondpilot.ai.adapter.ChatProviderException.Failure;
import org.jspecify.annotations.Nullable;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads a provider's list of models, the part every adapter shares: one request through {@link OutboundHttp}, the
 * same three kinds of failure, and one reading of the fields vendors publish. It follows MemoryOS's
 * {@code OpenAiProviderAdapter.reportedModels}.
 */
final class ModelLists {

	/** OpenRouter's list with descriptions is about 2 MiB; the cap still bounds a hostile endpoint. */
	private static final int MAX_BYTES = 16 * 1_048_576;

	private static final int MAX_MODELS = 1000;

	private static final JsonMapper JSON = JsonMapper.builder().build();

	private ModelLists() {
	}

	/**
	 * @param address the full address of the list
	 * @param headers what carries the key; the address never does
	 */
	static List<ReportedModel> read(String address, Map<String, String> headers, Duration timeout) {
		OutboundHttp.Answer answer;
		try {
			answer = OutboundHttp.get(address, headers, new OutboundHttp.Limits(timeout, MAX_BYTES));
		}
		catch (IOException unreachable) {
			throw new ChatProviderException(Failure.UNREACHABLE);
		}
		int status = answer.status();
		if (status == 401 || status == 403) {
			throw new ChatProviderException(Failure.CREDENTIAL_REJECTED);
		}
		if (status >= 500) {
			throw new ChatProviderException(Failure.UNREACHABLE);
		}
		if (status >= 300 || answer.body().length == 0 || answer.body().length > MAX_BYTES) {
			throw new ChatProviderException(Failure.INCOMPATIBLE);
		}
		return parse(answer.body());
	}

	static List<ReportedModel> parse(byte[] body) {
		JsonNode data;
		try {
			data = JSON.readTree(body).path("data");
		}
		catch (JacksonException notJson) {
			throw new ChatProviderException(Failure.INCOMPATIBLE);
		}
		if (!data.isArray()) {
			throw new ChatProviderException(Failure.INCOMPATIBLE);
		}
		List<ReportedModel> models = new ArrayList<>();
		for (JsonNode item : data) {
			String id = item.path("id").asString("");
			if (!id.isBlank()) {
				models.add(reported(id, item));
			}
			if (models.size() >= MAX_MODELS) {
				break;
			}
		}
		return models;
	}

	/**
	 * What one entry publishes. Field names follow the vendors that publish them: OpenRouter ({@code context_length},
	 * {@code top_provider.max_completion_tokens}, {@code supported_parameters}, {@code architecture.input_modalities},
	 * per-token {@code pricing}), vLLM ({@code max_model_len}), Groq ({@code context_window}), Mistral
	 * ({@code max_context_length}, {@code capabilities}), Anthropic ({@code max_input_tokens}, {@code max_tokens},
	 * nested {@code supported} flags), Gemini ({@code inputTokenLimit}) and 9Router ({@code capabilities.tools}).
	 * Anything absent stays null.
	 */
	static ReportedModel reported(String id, JsonNode item) {
		Integer context = firstInt(item, "context_length", "max_model_len", "context_window", "max_context_length",
				"max_input_tokens", "input_token_limit", "inputTokenLimit");
		if (context == null) {
			context = firstInt(item.path("top_provider"), "context_length");
		}
		Integer output = firstInt(item.path("top_provider"), "max_completion_tokens");
		if (output == null) {
			output = firstInt(item, "max_completion_tokens", "max_output_tokens", "max_tokens", "output_token_limit",
					"outputTokenLimit");
		}
		JsonNode parameters = item.path("supported_parameters");
		JsonNode capabilities = item.path("capabilities");
		JsonNode modalities = item.path("architecture").path("input_modalities");
		Boolean tools = parameters.isArray() ? Boolean.valueOf(contains(parameters, "tools"))
				: flag(capabilities, "function_calling");
		Boolean reasoning = parameters.isArray() ? Boolean.valueOf(contains(parameters, "reasoning"))
				: flag(capabilities, "reasoning");
		Boolean vision = modalities.isArray() ? Boolean.valueOf(contains(modalities, "image"))
				: flag(capabilities, "vision");
		if (tools == null) {
			tools = flag(capabilities, "tools");
		}
		if (vision == null) {
			vision = flag(capabilities.path("image_input"), "supported");
		}
		if (reasoning == null) {
			reasoning = flag(capabilities.path("thinking"), "supported");
		}
		if (reasoning == null) {
			reasoning = flag(item, "thinking");
		}
		return new ReportedModel(id, context, output, tools, vision, reasoning, pricing(item.path("pricing")));
	}

	/**
	 * OpenRouter prices per token as decimal strings ({@code prompt}, {@code completion},
	 * {@code input_cache_read}); Together per million tokens ({@code input}, {@code output}). A negative or missing
	 * value means variable or unpublished.
	 */
	private static ReportedModel.@Nullable Pricing pricing(JsonNode pricing) {
		BigDecimal prompt = amount(pricing.path("prompt"));
		BigDecimal completion = amount(pricing.path("completion"));
		if (prompt != null && completion != null) {
			BigDecimal cached = amount(pricing.path("input_cache_read"));
			return new ReportedModel.Pricing(perMillion(prompt), perMillion(completion),
					cached == null ? null : perMillion(cached));
		}
		BigDecimal input = amount(pricing.path("input"));
		BigDecimal output = amount(pricing.path("output"));
		return input == null || output == null ? null : new ReportedModel.Pricing(scaled(input), scaled(output), null);
	}

	private static @Nullable BigDecimal amount(JsonNode node) {
		if (!node.isString() && !node.isNumber()) {
			return null;
		}
		try {
			BigDecimal value = new BigDecimal(node.asString());
			return value.signum() >= 0 ? value : null;
		}
		catch (NumberFormatException notANumber) {
			return null;
		}
	}

	private static BigDecimal perMillion(BigDecimal perToken) {
		return scaled(perToken.movePointRight(6));
	}

	private static BigDecimal scaled(BigDecimal value) {
		return value.setScale(6, RoundingMode.HALF_UP);
	}

	private static @Nullable Integer firstInt(JsonNode node, String... fields) {
		for (String field : fields) {
			JsonNode value = node.path(field);
			if (value.canConvertToInt() && value.asInt() > 0) {
				return value.asInt();
			}
		}
		return null;
	}

	private static @Nullable Boolean flag(JsonNode node, String field) {
		JsonNode value = node.path(field);
		return value.isBoolean() ? Boolean.valueOf(value.asBoolean()) : null;
	}

	private static boolean contains(JsonNode array, String value) {
		for (JsonNode item : array) {
			if (value.equals(item.asString(""))) {
				return true;
			}
		}
		return false;
	}

}
