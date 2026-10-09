package ai.genaifund.beyondpilot.ai.adapter;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import ai.genaifund.beyondpilot.ai.ReasoningEffort;
import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Component;

/** Claude through Anthropic's own API, with Spring AI's Anthropic module. */
@Component
class AnthropicChatAdapter implements ChatAdapter {

	static final String TYPE = "anthropic";

	/** The API requires an answer limit; Spring AI's default of 4,096 truncates a judged list. */
	private static final int ANSWER_TOKENS = 8192;

	private static final String API_VERSION = "2023-06-01";

	@Override
	public String type() {
		return TYPE;
	}

	@Override
	public List<ReportedModel> reportedModels(ChatConnection connection, Duration timeout) {
		return ModelLists.read(root(connection.baseUrl()) + "/v1/models?limit=1000",
				Map.of("x-api-key", connection.apiKey(), "anthropic-version", API_VERSION), timeout);
	}

	@Override
	public ChatModel connect(ChatConnection connection, String model, ChatModelOptions options) {
		long thinking = options.reasons() ? budget(options.effort()) : 0;
		int answer = options.maxOutputTokens() == null ? ANSWER_TOKENS : Math.min(ANSWER_TOKENS, options.maxOutputTokens());
		AnthropicChatOptions.Builder chat = AnthropicChatOptions.builder()
			.baseUrl(root(connection.baseUrl()))
			.apiKey(connection.apiKey())
			.model(model)
			.timeout(options.timeout())
			.maxRetries(1)
			// The limit covers the thinking and the answer together.
			.maxTokens((int) Math.min(Integer.MAX_VALUE, thinking + answer));
		if (thinking > 0) {
			chat.thinkingEnabled(thinking);
		}
		else {
			chat.thinkingDisabled();
		}
		return AnthropicChatModel.builder().options(chat.build()).build();
	}

	/** How many tokens the model may think with at each level, as Embabel budgets Claude's thinking. */
	private static long budget(ReasoningEffort effort) {
		return switch (effort) {
			case OFF -> 0;
			case LOW -> 2048;
			case MEDIUM -> 8192;
			case HIGH -> 24576;
		};
	}

	/** The API's root: the client adds {@code /v1} itself, so one typed at the end is dropped. */
	private static String root(String baseUrl) {
		String base = ChatEndpoints.base(baseUrl);
		return base.endsWith("/v1") ? base.substring(0, base.length() - 3) : base;
	}

}
