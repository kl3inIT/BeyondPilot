package ai.genaifund.beyondpilot.matching;

import java.util.List;

import ai.genaifund.beyondpilot.ai.AiChat;
import org.jspecify.annotations.Nullable;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.converter.BeanOutputConverter;

/**
 * Asks a model for an answer of a known shape. The shape is told to the model as Spring AI's converter writes it, and
 * the answer is read back by the same converter. An answer that does not fit is asked for once more; each call goes
 * through the task's client, so each is recorded.
 */
final class Asking {

	/** How many times a question is asked when the answer does not fit its shape. */
	private static final int ATTEMPTS = 2;

	private Asking() {
	}

	/**
	 * An answer with what it cost.
	 * @param calls how many calls reached the provider
	 */
	record Answer<T>(T value, int calls, long inputTokens, long outputTokens) {
	}

	/** The answer never fitted its shape. */
	static final class UnreadableAnswer extends RuntimeException {

		private static final long serialVersionUID = 1L;

		UnreadableAnswer() {
			super("The model's answer did not fit its shape");
		}

	}

	/**
	 * @throws UnreadableAnswer when no attempt gave an answer of the shape
	 * @throws RuntimeException when the provider refused or failed
	 */
	static <T> Answer<T> ask(AiChat chat, String system, String user, Class<T> shape) {
		BeanOutputConverter<T> converter = new BeanOutputConverter<>(shape);
		// The texts go as messages, not as templates: a deck or a brief may hold braces a template would read.
		List<Message> messages = List.of(new SystemMessage(system),
				new UserMessage(user + System.lineSeparator() + System.lineSeparator() + converter.getFormat()));
		long input = 0;
		long output = 0;
		for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
			ChatResponse response = chat.client().prompt().messages(messages).call().chatResponse();
			Usage usage = response == null ? null : response.getMetadata().getUsage();
			if (usage != null) {
				input += count(usage.getPromptTokens());
				output += count(usage.getCompletionTokens());
			}
			T value = read(converter, response);
			if (value != null) {
				return new Answer<>(value, attempt, input, output);
			}
		}
		throw new UnreadableAnswer();
	}

	private static <T> @Nullable T read(BeanOutputConverter<T> converter, @Nullable ChatResponse response) {
		if (response == null || response.getResult() == null) {
			return null;
		}
		String text = response.getResult().getOutput().getText();
		if (text == null || text.isBlank()) {
			return null;
		}
		try {
			return converter.convert(text);
		}
		catch (RuntimeException unreadable) {
			return null;
		}
	}

	private static long count(@Nullable Integer tokens) {
		return tokens == null ? 0 : tokens;
	}

}
