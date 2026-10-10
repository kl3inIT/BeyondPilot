package ai.genaifund.beyondpilot.ai.adapter;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;

import ai.genaifund.beyondpilot.ai.ReasoningEffort;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * What the adapter asks of Anthropic's API, against a server that answers as the API does. Claude from 4.7 on refuses
 * a thinking budget and several models refuse thinking turned off, so every request asks for adaptive thinking and an
 * effort level, whatever the task's setting.
 */
class AnthropicChatAdapterTest {

	/** An answer that starts with a thinking block without text, as the newer models send it. */
	private static final String ANSWER = """
			{"id":"msg_01","type":"message","role":"assistant","model":"claude-sonnet-5-5",
			 "content":[{"type":"thinking","thinking":"","signature":"c2lnbmF0dXJl"},{"type":"text","text":"read"}],
			 "stop_reason":"end_turn","stop_sequence":null,
			 "usage":{"input_tokens":12,"output_tokens":7}}
			""";

	private final AtomicReference<String> asked = new AtomicReference<>();

	private HttpServer server;

	@BeforeEach
	void start() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/v1/messages", exchange -> {
			asked.set(new String(exchange.getRequestBody().readAllBytes(), UTF_8));
			byte[] body = ANSWER.getBytes(UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json");
			exchange.sendResponseHeaders(200, body.length);
			exchange.getResponseBody().write(body);
			exchange.close();
		});
		server.start();
	}

	@AfterEach
	void stop() {
		server.stop(0);
	}

	@Test
	void aTaskThatReasonsAsksForAdaptiveThinkingAtItsLevel() {
		String text = call(new ChatModelOptions(128_000, true, ReasoningEffort.MEDIUM, Duration.ofSeconds(20)));

		JsonNode sent = sent();
		assertThat(sent.path("thinking").path("type").asString()).isEqualTo("adaptive");
		assertThat(sent.path("thinking").has("budget_tokens")).isFalse();
		assertThat(sent.path("output_config").path("effort").asString()).isEqualTo("medium");
		assertThat(sent.path("max_tokens").asInt()).isEqualTo(20_000);
		// The text is read past the thinking block the answer starts with.
		assertThat(text).isEqualTo("read");
	}

	@Test
	void reasoningTurnedOffIsTheLowestEffortAndNeverThinkingDisabled() {
		call(new ChatModelOptions(128_000, true, ReasoningEffort.OFF, Duration.ofSeconds(20)));

		JsonNode sent = sent();
		assertThat(sent.path("thinking").path("type").asString()).isEqualTo("adaptive");
		assertThat(sent.path("output_config").path("effort").asString()).isEqualTo("low");
	}

	@Test
	void aModelNotMarkedAsReasoningIsAskedTheSameWayAndWithinItsOwnLimit() {
		call(new ChatModelOptions(8_000, false, ReasoningEffort.HIGH, Duration.ofSeconds(20)));

		JsonNode sent = sent();
		assertThat(sent.path("thinking").path("type").asString()).isEqualTo("adaptive");
		assertThat(sent.path("output_config").path("effort").asString()).isEqualTo("low");
		assertThat(sent.path("max_tokens").asInt()).isEqualTo(8_000);
	}

	private String call(ChatModelOptions options) {
		String address = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1";
		ChatModel model = new AnthropicChatAdapter().connect(new ChatConnection(address, "test-key"), "claude-sonnet-5-5",
				options);
		String text = model.call(new Prompt("Say read.")).getResult().getOutput().getText();
		return text == null ? "" : text;
	}

	private JsonNode sent() {
		return JsonMapper.builder().build().readTree(asked.get());
	}

}
