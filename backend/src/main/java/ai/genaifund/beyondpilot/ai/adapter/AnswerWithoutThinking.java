package ai.genaifund.beyondpilot.ai.adapter;

import java.util.List;
import java.util.Map;

import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import reactor.core.publisher.Flux;

/**
 * A Claude model whose response holds its answer only. Claude answers in blocks, and a thinking block comes before the
 * text; Spring AI makes a result of each block, so the first result, which is what a caller reads, is the thinking and
 * holds no text. Here the thinking is left out of the results, and the first one is the answer.
 */
final class AnswerWithoutThinking implements ChatModel {

	/** What Spring AI writes on the message of a thinking block: its signature, or that it is redacted. */
	private static final List<String> THINKING_MARKS = List.of("signature", "redacted");

	private final ChatModel model;

	AnswerWithoutThinking(ChatModel model) {
		this.model = model;
	}

	@Override
	public ChatResponse call(Prompt prompt) {
		ChatResponse response = model.call(prompt);
		List<Generation> answers = response.getResults().stream().filter(result -> !thinking(result)).toList();
		// A response that is thinking only is given as it came: its caller finds no text and says so.
		if (answers.isEmpty() || answers.size() == response.getResults().size()) {
			return response;
		}
		return new ChatResponse(answers, response.getMetadata());
	}

	@Override
	public Flux<ChatResponse> stream(Prompt prompt) {
		return model.stream(prompt);
	}

	@Override
	public ChatOptions getOptions() {
		return model.getOptions();
	}

	private static boolean thinking(Generation result) {
		AssistantMessage said = result.getOutput();
		Map<String, Object> marks = said.getMetadata();
		if (THINKING_MARKS.stream().anyMatch(marks::containsKey)) {
			return true;
		}
		String text = said.getText();
		return (text == null || text.isBlank()) && !said.hasToolCalls();
	}

}
