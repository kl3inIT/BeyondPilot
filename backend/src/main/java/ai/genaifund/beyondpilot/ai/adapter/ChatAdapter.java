package ai.genaifund.beyondpilot.ai.adapter;

import java.time.Duration;
import java.util.List;

import org.springframework.ai.chat.model.ChatModel;

/** Reaches the chat models of the providers that speak one API. */
public interface ChatAdapter {

	/** The stable name a provider is stored with, such as {@code openai}. */
	String type();

	/**
	 * The models the provider lists, with what it publishes about each. No tokens are spent.
	 * @throws ChatProviderException when the key is refused, the provider cannot be reached, or the answer is not this
	 * API's
	 */
	List<ReportedModel> reportedModels(ChatConnection connection, Duration timeout);

	/** A client for one model of the provider; nothing is sent until it is called. */
	ChatModel connect(ChatConnection connection, String model, ChatModelOptions options);

}
