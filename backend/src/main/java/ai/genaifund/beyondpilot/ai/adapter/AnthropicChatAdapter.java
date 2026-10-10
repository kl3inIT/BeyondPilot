package ai.genaifund.beyondpilot.ai.adapter;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import com.anthropic.models.messages.OutputConfig;
import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Component;

/**
 * Claude through Anthropic's own API, with Spring AI's Anthropic module.
 *
 * <p>
 * Thinking is always asked for as adaptive, and how hard the model works as an effort level. It is the one pair every
 * model from Claude 4.6 on accepts: those from 4.7 on refuse a thinking budget ({@code enabled}) with a 400, and
 * several of them refuse {@code disabled} too (Sonnet 5.5, Opus 5.5, Fable). Models before 4.6, which know a budget
 * only, are not served (platform.claude.com/docs/en/build-with-claude/thinking-troubleshooting, read on 10 October
 * 2026).
 */
@Component
class AnthropicChatAdapter implements ChatAdapter {

	static final String TYPE = "anthropic";

	/**
	 * The limit of one answer, thinking included: the API requires one, and what the model thinks counts in it. It
	 * stays under the size from which the client refuses a call that is not streamed.
	 */
	private static final int OUTPUT_TOKENS = 20_000;

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
		int limit = options.maxOutputTokens() == null ? OUTPUT_TOKENS : Math.min(OUTPUT_TOKENS, options.maxOutputTokens());
		AnthropicChatOptions.Builder chat = AnthropicChatOptions.builder()
			.baseUrl(root(connection.baseUrl()))
			.apiKey(connection.apiKey())
			.model(model)
			.timeout(options.timeout())
			.maxRetries(1)
			.maxTokens(limit);
		chat.thinkingAdaptive();
		chat.effort(effort(options));
		return new AnswerWithoutThinking(AnthropicChatModel.builder().options(chat.build()).build());
	}

	/**
	 * The effort asked of the model. Off is the lowest level: thinking cannot be turned off on every model, and at
	 * low effort a model thinks only where it must.
	 */
	private static OutputConfig.Effort effort(ChatModelOptions options) {
		if (!options.reasons()) {
			return OutputConfig.Effort.LOW;
		}
		return switch (options.effort()) {
			case OFF, LOW -> OutputConfig.Effort.LOW;
			case MEDIUM -> OutputConfig.Effort.MEDIUM;
			case HIGH -> OutputConfig.Effort.HIGH;
		};
	}

	/** The API's root: the client adds {@code /v1} itself, so one typed at the end is dropped. */
	private static String root(String baseUrl) {
		String base = ChatEndpoints.base(baseUrl);
		return base.endsWith("/v1") ? base.substring(0, base.length() - 3) : base;
	}

}
