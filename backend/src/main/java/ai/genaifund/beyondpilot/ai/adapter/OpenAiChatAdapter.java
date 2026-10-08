package ai.genaifund.beyondpilot.ai.adapter;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import ai.genaifund.beyondpilot.ai.ReasoningEffort;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.stereotype.Component;

/**
 * Providers that speak the OpenAI API: OpenAI, 9Router, OpenRouter and any compatible endpoint. They differ only by
 * address, so one adapter serves them all, as in MemoryOS.
 */
@Component
class OpenAiChatAdapter implements ChatAdapter {

	static final String TYPE = "openai";

	@Override
	public String type() {
		return TYPE;
	}

	@Override
	public List<ReportedModel> reportedModels(ChatConnection connection, Duration timeout) {
		return ModelLists.read(ChatEndpoints.base(connection.baseUrl()) + "/models",
				Map.of("Authorization", "Bearer " + connection.apiKey()), timeout);
	}

	@Override
	public ChatModel connect(ChatConnection connection, String model, ChatModelOptions options) {
		// No answer limit is sent: the API then allows the model's own, and compatible endpoints disagree on whether
		// the limit is max_tokens or max_completion_tokens.
		OpenAiChatOptions.Builder chat = OpenAiChatOptions.builder()
			.baseUrl(connection.baseUrl())
			.apiKey(connection.apiKey())
			.model(model)
			.timeout(options.timeout())
			.maxRetries(1);
		if (options.reasons()) {
			chat.reasoningEffort(effort(options.effort()));
		}
		return OpenAiChatModel.builder().options(chat.build()).build();
	}

	/**
	 * The level as the API names it. Off is {@code none}, which GPT-5.1 and later and the gateways take as no
	 * reasoning; the first GPT-5 family refuses it, and a task on such a model is set to Low instead.
	 */
	private static String effort(ReasoningEffort effort) {
		return effort == ReasoningEffort.OFF ? "none" : effort.value();
	}

}
