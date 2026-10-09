package ai.genaifund.beyondpilot.ai;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestPdf;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * The OCR tab of Admin › AI › Providers over real HTTP against PostgreSQL, and what the reader chosen there reads. AI
 * Hay is played by the JDK's own HTTP server, answering as the real service answered on 9 October 2026; no test calls
 * a real provider.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@ocr.test")
@Import({ TestcontainersConfiguration.class, OcrAdministrationTest.Mail.class })
class OcrAdministrationTest {

	private static final String API = "/api/ai/admin/ocr";

	private static final String CHAT = "/api/ai/admin/chat";

	/** A secret part of the key that must never be read back. */
	private static final String SECRET = "Q7xSecretPart";

	private static final String GOOD_KEY = "sk-ah-" + SECRET;

	/** What the service says when it fails; none of it may reach a response. */
	private static final String PROVIDER_TEXT = "failed to download img_url: HTTP 400";

	/** What AI Hay answers for a slide: Markdown, with image syntax it can invent. */
	private static final String MARKDOWN = "# What Is Really Happening?\\n\\n![Image 1](https://i.imgur.com/placeholder1.jpg) 2468";

	/** A key made for this run, so that no key is written in the repository. */
	@DynamicPropertySource
	static void encryptionKey(DynamicPropertyRegistry registry) {
		byte[] key = new byte[32];
		new SecureRandom().nextBytes(key);
		registry.add("beyondpilot.ai.encryption-key", () -> Base64.getEncoder().encodeToString(key));
	}

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private DocumentPages documents;

	private RestTestClient client;

	private String operator;

	private HttpServer service;

	/** What the service was asked: the path, the header that carried the key, and the kind of picture sent. */
	private final List<String> asked = new CopyOnWriteArrayList<>();

	@BeforeEach
	void setUp() throws IOException {
		jdbc.sql("update ai_task_model set model_id = null, ocr_provider_id = null, reasoning_effort = null, version = 0")
			.update();
		jdbc.sql("delete from ai_provider where purpose in ('chat', 'ocr')").update();
		jdbc.sql("delete from ai_usage").update();
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
		operator = TestSignIn.session(client, mail, "operator@ocr.test");
		service = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		service.createContext("/good/v1/ocr", reading(exchange -> answer(exchange, 200,
				"{\"result\":{\"text\":\"" + MARKDOWN + "\"},\"token_usage\":{\"api_calls\":1}}")));
		service.createContext("/misread/v1/ocr", reading(exchange -> answer(exchange, 200,
				"{\"result\":{\"text\":\"\"},\"token_usage\":{\"api_calls\":1}}")));
		// The first picture is refused, as a picture the service cannot take is; the next is read.
		AtomicInteger sent = new AtomicInteger();
		service.createContext("/picky/v1/ocr", reading(exchange -> {
			if (sent.getAndIncrement() == 0) {
				answer(exchange, 400, "{\"err\":-4011,\"err_msg\":\"invalid_value\",\"err_extra\":\"" + PROVIDER_TEXT + "\"}");
				return;
			}
			answer(exchange, 200, "{\"result\":{\"text\":\"Second page\"},\"token_usage\":{\"api_calls\":1}}");
		}));
		service.createContext("/down/v1/ocr", exchange -> answer(exchange, 503,
				"{\"err\":-4051,\"err_msg\":\"upstream_unavailable\",\"err_extra\":\"" + PROVIDER_TEXT + "\"}"));
		service.createContext("/html/v1/ocr", exchange -> answer(exchange, 200, "<html>" + PROVIDER_TEXT + "</html>"));
		service.createContext("/moved/v1/ocr", exchange -> {
			exchange.getResponseHeaders().add("Location", "http://127.0.0.1:" + service.getAddress().getPort() + "/stolen");
			answer(exchange, 302, "");
		});
		service.createContext("/stolen", exchange -> {
			asked.add("STOLEN " + exchange.getRequestHeaders().getFirst("Authorization"));
			answer(exchange, 200, "{\"result\":{\"text\":\"2468\"}}");
		});
		// The chat API of a gateway, for a model as the reader: it answers OK and says what the call took.
		service.createContext("/v1/chat/completions", exchange -> {
			asked.add("POST /v1/chat/completions " + new String(exchange.getRequestBody().readAllBytes(), UTF_8));
			answer(exchange, 200, """
					{"id":"chatcmpl-1","object":"chat.completion","created":1,"model":"gpt-5",
					 "choices":[{"index":0,"message":{"role":"assistant","content":"OK"},"finish_reason":"stop"}],
					 "usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}}""");
		});
		service.start();
	}

	@AfterEach
	void stopService() {
		service.stop(0);
	}

	@Test
	void onlyOperatorsSeeOrChangeTheOcrSettings() {
		String member = TestSignIn.session(client, mail, "member@ocr.test");

		assertProblem(get(member, API), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(send("POST", member, API + "/providers", provider("AI Hay", url("/good"), GOOD_KEY)), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		assertProblem(send("POST", member, API + "/providers/test", probe(null, url("/good"), GOOD_KEY)), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		assertProblem(send("PUT", member, API + "/reader", reader(null, null, null, 0)), 403,
				"IDENTITY_OPERATOR_REQUIRED");
	}

	@Test
	void anOcrProviderIsConnectedChangedAndRemovedAndItsKeyNeverComesOut() {
		String empty = body(get(operator, API).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(empty, "$.adapters")).containsExactly("aihay");
		assertThat(JsonPath.<List<Object>>read(empty, "$.providers")).isEmpty();
		assertThat(JsonPath.<Boolean>read(empty, "$.reader.available")).isFalse();

		String connected = body(send("POST", operator, API + "/providers", provider("AI Hay", url("/good"), GOOD_KEY))
			.expectStatus()
			.isOk());

		assertThat(connected).doesNotContain(SECRET);
		assertThat(JsonPath.<Boolean>read(connected, "$.providers[0].hasKey")).isTrue();
		assertThat(JsonPath.<Boolean>read(connected, "$.providers[0].inUse")).isFalse();
		String id = JsonPath.read(connected, "$.providers[0].id");
		// The same name is free for a chat provider: a name is unique within its purpose.
		assertProblem(send("POST", operator, API + "/providers", provider("ai hay", url("/good"), GOOD_KEY)), 409,
				"AI_PROVIDER_NAME_TAKEN");
		assertProblem(send("POST", operator, API + "/providers", provider("Other", url("/good") + "?key=1", GOOD_KEY)), 400,
				"AI_PROVIDER_ENDPOINT_INVALID");
		Map<String, Object> unknown = provider("Other", url("/good"), GOOD_KEY);
		unknown.put("adapterType", "openai");
		assertProblem(send("POST", operator, API + "/providers", unknown), 400, "AI_PROVIDER_ADAPTER_UNKNOWN");

		// A stale change is refused; the one read at the current version is taken, and keeps the key.
		Map<String, Object> renamed = provider("AI Hay OCR", url("/good"), null);
		renamed.put("key", "keep");
		renamed.put("version", 7);
		assertProblem(send("PUT", operator, API + "/providers/" + id, renamed), 409, "AI_PROVIDER_CHANGED");
		renamed.put("version", JsonPath.<Integer>read(connected, "$.providers[0].version"));
		String changed = body(send("PUT", operator, API + "/providers/" + id, renamed).expectStatus().isOk());
		assertThat(JsonPath.<String>read(changed, "$.providers[0].name")).isEqualTo("AI Hay OCR");
		assertThat(JsonPath.<Boolean>read(changed, "$.providers[0].hasKey")).isTrue();

		String removed = body(send("DELETE", operator, API + "/providers/" + id, null).expectStatus().isOk());
		assertThat(JsonPath.<List<Object>>read(removed, "$.providers")).isEmpty();
		assertThat(jdbc.sql("select action from audit_event where resource_id = :id order by occurred_at")
			.param("id", id)
			.query(String.class)
			.list()).containsExactly("ai.provider_create", "ai.provider_update", "ai.provider_delete");
	}

	@Test
	void aTestSendsOnePictureAndNamesWhatWentWrongWithoutTheServicesWords() {
		String read = body(send("POST", operator, API + "/providers/test", probe(null, url("/good"), GOOD_KEY))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Boolean>read(read, "$.ok")).isTrue();
		assertThat(asked).containsExactly("POST /good/v1/ocr Bearer " + GOOD_KEY + " jpeg");

		assertThat(reason(probe(null, url("/good"), "sk-ah-wrong"))).isEqualTo("rejected");
		assertThat(reason(probe(null, url("/misread"), GOOD_KEY))).isEqualTo("misread");
		assertThat(reason(probe(null, url("/down"), GOOD_KEY))).isEqualTo("unreachable");
		assertThat(reason(probe(null, url("/html"), GOOD_KEY))).isEqualTo("incompatible");
		// A redirect is not followed, so the key is not sent on to another host.
		assertThat(reason(probe(null, url("/moved"), GOOD_KEY))).isEqualTo("incompatible");
		assertThat(asked).noneMatch(line -> line.startsWith("STOLEN"));
		assertThat(reason(probe(null, "http://127.0.0.1:1", GOOD_KEY))).isEqualTo("unreachable");

		// The saved key is used for the address it was saved with, and for no other.
		String id = JsonPath.read(body(send("POST", operator, API + "/providers", provider("AI Hay", url("/good"), GOOD_KEY))
			.expectStatus()
			.isOk()), "$.providers[0].id");
		assertThat(JsonPath.<Boolean>read(body(send("POST", operator, API + "/providers/test", probe(id, url("/good"), null))
			.expectStatus()
			.isOk()), "$.ok")).isTrue();
		assertProblem(send("POST", operator, API + "/providers/test", probe(id, url("/stolen"), null)), 400,
				"AI_PROVIDER_KEY_MISSING");
	}

	@Test
	void anOcrProviderReadsThePagesThatAreOnlyAPictureAndEachCallIsRecorded() throws IOException {
		String id = readerOn(url("/good"));
		assertThat(documents.readsPictures()).isTrue();
		String settings = body(get(operator, API).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(settings, "$.providers[0].inUse")).isTrue();
		assertThat(JsonPath.<Boolean>read(settings, "$.reader.available")).isTrue();
		assertThat(JsonPath.<String>read(settings, "$.reader.ocrProviderId")).isEqualTo(id);

		byte[] pdf = TestPdf.of("A slide", "", "");
		Map<Integer, String> read = documents.readPictures(() -> new ByteArrayInputStream(pdf), List.of(2, 3),
				new AiSubject("solution_deck", "s-1"));

		// What the service returns is kept as it comes, its Markdown and the image syntax it can invent included.
		String text = "# What Is Really Happening?\n\n![Image 1](https://i.imgur.com/placeholder1.jpg) 2468";
		assertThat(read).containsExactly(Map.entry(2, text), Map.entry(3, text));
		assertThat(asked).containsExactly("POST /good/v1/ocr Bearer " + GOOD_KEY + " jpeg",
				"POST /good/v1/ocr Bearer " + GOOD_KEY + " jpeg");
		List<Map<String, Object>> rows = jdbc.sql("select * from ai_usage").query().listOfRows();
		assertThat(rows).hasSize(2).allSatisfy(row -> {
			assertThat(row).containsEntry("task", "document_reading")
				.containsEntry("provider_name", "AI Hay")
				.containsEntry("model_name", "aihay")
				.containsEntry("outcome", "ok")
				.containsEntry("subject_type", "solution_deck")
				.containsEntry("subject_id", "s-1");
			assertThat(row.get("provider_id")).hasToString(id);
			assertThat(row.get("input_tokens")).isNull();
			assertThat(row.get("input_price")).isNull();
		});
	}

	@Test
	void aPictureTheServiceRefusesIsSettledAsEmptyAndTheNextIsStillRead() throws IOException {
		readerOn(url("/picky"));
		byte[] pdf = TestPdf.of("", "");

		Map<Integer, String> read = documents.readPictures(() -> new ByteArrayInputStream(pdf), List.of(1, 2),
				new AiSubject("solution_deck", "s-1"));

		assertThat(read).containsExactly(Map.entry(1, ""), Map.entry(2, "Second page"));
		assertThat(jdbc.sql("select outcome from ai_usage order by occurred_at").query(String.class).list())
			.containsExactly("failed", "ok");
		assertThat(jdbc.sql("select * from ai_usage").query().listOfRows().toString()).doesNotContain(PROVIDER_TEXT);
	}

	@Test
	void aServiceThatDoesNotAnswerStopsTheReadingAndLeavesThePagesForLater() throws IOException {
		readerOn(url("/down"));
		byte[] pdf = TestPdf.of("", "");

		Map<Integer, String> read = documents.readPictures(() -> new ByteArrayInputStream(pdf), List.of(1, 2),
				new AiSubject("solution_deck", "s-1"));

		// Neither page is settled, and the second was not sent.
		assertThat(read).isEmpty();
		assertThat(jdbc.sql("select outcome from ai_usage").query(String.class).list()).containsExactly("failed");
	}

	@Test
	void theReaderIsAModelOrAnOcrProviderNeverBothAndOnlyOneThatCanBeUsed() {
		String id = JsonPath.read(body(send("POST", operator, API + "/providers", provider("AI Hay", url("/good"), GOOD_KEY))
			.expectStatus()
			.isOk()), "$.providers[0].id");
		Models models = chatModels();

		assertProblem(send("PUT", operator, API + "/reader", reader(models.sees(), "low", id, 0)), 400, "AI_READER_AMBIGUOUS");
		assertProblem(send("PUT", operator, API + "/reader", reader(models.blind(), "low", null, 0)), 400,
				"AI_MODEL_WITHOUT_VISION");
		assertProblem(send("PUT", operator, API + "/reader", reader(null, null, UUID.randomUUID().toString(), 0)), 404,
				"AI_PROVIDER_NOT_FOUND");
		assertProblem(send("PUT", operator, API + "/reader", reader(null, null, id, 9)), 409, "AI_TASK_CHANGED");

		// A provider switched off cannot be chosen, and one chosen then switched off reads nothing.
		String chosen = body(send("PUT", operator, API + "/reader", reader(null, null, id, 0)).expectStatus().isOk());
		assertThat(documents.readsPictures()).isTrue();
		Map<String, Object> off = provider("AI Hay", url("/good"), null);
		off.put("key", "keep");
		off.put("enabled", false);
		off.put("version", JsonPath.<Integer>read(chosen, "$.providers[0].version"));
		String switchedOff = body(send("PUT", operator, API + "/providers/" + id, off).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(switchedOff, "$.reader.available")).isFalse();
		assertThat(documents.readsPictures()).isFalse();
		assertThatThrownBy(() -> documents.readPictures(() -> new ByteArrayInputStream(TestPdf.of("")), List.of(1),
				new AiSubject("solution_deck", "s-1")))
			.isInstanceOf(AiException.class)
			.extracting(failure -> ((AiException) failure).errorCode())
			.isEqualTo(AiErrorCode.TASK_NOT_CONFIGURED);
		int version = JsonPath.read(switchedOff, "$.reader.version");
		assertProblem(send("PUT", operator, API + "/reader", reader(null, null, id, version)), 400,
				"AI_OCR_PROVIDER_UNAVAILABLE");

		// Choosing a model takes the provider's place, and removing the provider that reads leaves no reader.
		String onModel = body(send("PUT", operator, API + "/reader", reader(models.sees(), "low", null, version))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(onModel, "$.reader.modelId")).isEqualTo(models.sees());
		assertThat(JsonPath.<Object>read(onModel, "$.reader.ocrProviderId")).isNull();
		assertThat(JsonPath.<Boolean>read(onModel, "$.providers[0].inUse")).isFalse();
		off.put("enabled", true);
		off.put("version", JsonPath.<Integer>read(onModel, "$.providers[0].version"));
		send("PUT", operator, API + "/providers/" + id, off).expectStatus().isOk();
		String back = body(send("PUT", operator, API + "/reader",
				reader(null, null, id, JsonPath.<Integer>read(onModel, "$.reader.version")))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Object>read(back, "$.reader.modelId")).isNull();
		String removed = body(send("DELETE", operator, API + "/providers/" + id, null).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(removed, "$.reader.ocrProviderId")).isNull();
		assertThat(JsonPath.<Boolean>read(removed, "$.reader.available")).isFalse();
		assertThat(documents.readsPictures()).isFalse();
	}

	@Test
	void aModelThatReadsImagesStillReadsPagesSentAsPng() throws IOException {
		Models models = chatModels();
		assertThat(documents.readsPictures()).isFalse();
		String chosen = body(send("PUT", operator, API + "/reader", reader(models.sees(), "low", null, 0))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Boolean>read(chosen, "$.reader.available")).isTrue();
		assertThat(documents.readsPictures()).isTrue();
		// The Chat tab no longer lists the task, and counts the model as in use all the same.
		String chat = body(get(operator, CHAT).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(chat, "$.tasks[*].task")).containsExactly("matching");
		assertThat(JsonPath.<Boolean>read(chat, "$.providers[0].inUse")).isTrue();

		byte[] pdf = TestPdf.of("A slide", "");
		Map<Integer, String> read = documents.readPictures(() -> new ByteArrayInputStream(pdf), List.of(2),
				new AiSubject("solution_deck", "s-1"));

		assertThat(read).containsExactly(Map.entry(2, "OK"));
		String sent = asked.stream().filter(line -> line.startsWith("POST /v1/chat/completions")).findFirst().orElseThrow();
		assertThat(sent).contains("\"model\":\"gpt-5\"", "image_url", "data:image/png;base64,");
		assertThat(jdbc.sql("select task || ' ' || subject_type from ai_usage").query(String.class).single())
			.isEqualTo("document_reading solution_deck");
	}

	/** Connects AI Hay at an address and has it read pages; answers the provider's id. */
	private String readerOn(String baseUrl) {
		String connected = body(send("POST", operator, API + "/providers", provider("AI Hay", baseUrl, GOOD_KEY))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(connected, "$.providers[0].id");
		int version = JsonPath.read(connected, "$.reader.version");
		send("PUT", operator, API + "/reader", reader(null, null, id, version)).expectStatus().isOk();
		return id;
	}

	/** A chat gateway with one model that reads images and one that does not. */
	private Models chatModels() {
		Map<String, Object> gateway = provider("Gateway", url("/v1"), GOOD_KEY);
		gateway.put("adapterType", "openai");
		String connected = body(send("POST", operator, CHAT + "/providers", gateway).expectStatus().isOk());
		String id = JsonPath.read(connected, "$.providers[0].id");
		String added = body(send("POST", operator, CHAT + "/providers/" + id + "/models",
				Map.of("models", List.of(model("gpt-5-mini", false), model("gpt-5", true))))
			.expectStatus()
			.isOk());
		return new Models(
				JsonPath.<List<String>>read(added, "$.providers[0].models[?(@.modelName=='gpt-5-mini')].id").getFirst(),
				JsonPath.<List<String>>read(added, "$.providers[0].models[?(@.modelName=='gpt-5')].id").getFirst());
	}

	private record Models(String blind, String sees) {
	}

	private String reason(Map<String, Object> probe) {
		String tried = body(send("POST", operator, API + "/providers/test", probe).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(tried, "$.ok")).isFalse();
		assertThat(tried).doesNotContain(PROVIDER_TEXT).doesNotContain(SECRET);
		return JsonPath.read(tried, "$.reason");
	}

	/** Checks the key as AI Hay does and notes what was sent, then answers. */
	private HttpHandler reading(HttpHandler answer) {
		return exchange -> {
			String key = exchange.getRequestHeaders().getFirst("Authorization");
			String sent = new String(exchange.getRequestBody().readAllBytes(), UTF_8);
			byte[] picture = Base64.getDecoder().decode(JsonPath.<String>read(sent, "$.image"));
			boolean jpeg = picture.length > 2 && (picture[0] & 0xFF) == 0xFF && (picture[1] & 0xFF) == 0xD8;
			asked.add("POST " + exchange.getRequestURI().getPath() + " " + key + " " + (jpeg ? "jpeg" : "other"));
			if (!("Bearer " + GOOD_KEY).equals(key)) {
				answer(exchange, 401, "{\"err\":-4000,\"err_msg\":\"invalid_api_key\"}");
				return;
			}
			answer.handle(exchange);
		};
	}

	private String url(String path) {
		return "http://127.0.0.1:" + service.getAddress().getPort() + path;
	}

	private static Map<String, Object> provider(String name, String baseUrl, @Nullable String apiKey) {
		Map<String, Object> request = new HashMap<>();
		request.put("name", name);
		request.put("adapterType", "aihay");
		request.put("baseUrl", baseUrl);
		request.put("enabled", true);
		request.put("key", "replace");
		request.put("apiKey", apiKey);
		request.put("version", 0);
		return request;
	}

	private static Map<String, Object> probe(@Nullable String providerId, String baseUrl, @Nullable String apiKey) {
		Map<String, Object> request = new HashMap<>();
		request.put("providerId", providerId);
		request.put("adapterType", "aihay");
		request.put("baseUrl", baseUrl);
		request.put("apiKey", apiKey);
		return request;
	}

	private static Map<String, Object> reader(@Nullable String modelId, @Nullable String effort,
			@Nullable String ocrProviderId, long version) {
		Map<String, Object> request = new HashMap<>();
		request.put("modelId", modelId);
		request.put("reasoningEffort", effort);
		request.put("ocrProviderId", ocrProviderId);
		request.put("version", version);
		return request;
	}

	private static Map<String, Object> model(String name, boolean vision) {
		Map<String, Object> request = new HashMap<>();
		request.put("modelName", name);
		request.put("displayName", null);
		request.put("contextWindow", 272000);
		request.put("maxOutputTokens", 128000);
		request.put("toolCalling", true);
		request.put("vision", vision);
		request.put("reasoning", true);
		request.put("inputPrice", 0.25);
		request.put("outputPrice", 2);
		request.put("cachedInputPrice", null);
		request.put("version", 0);
		return request;
	}

	private static void answer(HttpExchange exchange, int status, String body) throws IOException {
		byte[] bytes = body.getBytes(UTF_8);
		exchange.getResponseHeaders().add("Content-Type", "application/json");
		exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
		if (bytes.length > 0) {
			exchange.getResponseBody().write(bytes);
		}
		exchange.close();
	}

	private RestTestClient.ResponseSpec get(String session, String path) {
		return client.get().uri(path).cookie(TestSignIn.SESSION_COOKIE, session).exchange();
	}

	private RestTestClient.ResponseSpec send(String method, String session, String path, @Nullable Object body) {
		RestTestClient.RequestBodySpec request = switch (method) {
			case "PUT" -> client.put().uri(path);
			case "DELETE" -> client.method(HttpMethod.DELETE).uri(path);
			default -> client.post().uri(path);
		};
		request = request.header(TestSignIn.CSRF_HEADER, "1").cookie(TestSignIn.SESSION_COOKIE, session);
		return (body == null ? request : request.contentType(MediaType.APPLICATION_JSON).body(body)).exchange();
	}

	private static String body(RestTestClient.ResponseSpec response) {
		return new String(response.expectBody().returnResult().getResponseBody(), UTF_8);
	}

	private static void assertProblem(RestTestClient.ResponseSpec response, int status, String code) {
		response.expectStatus()
			.isEqualTo(status)
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo(code);
	}

	/** The test mailbox, imported through a class of this test's own so that it keeps a database of its own. */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

}
