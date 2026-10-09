package ai.genaifund.beyondpilot.ai;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpExchange;
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
 * The Chat tab of Admin › AI › Providers over real HTTP against PostgreSQL. A provider is played by the JDK's own HTTP
 * server, as MemoryOS tests its adapter; no test calls a real provider.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@chat.test")
@Import({ TestcontainersConfiguration.class, AiAdministrationTest.Mail.class })
class AiAdministrationTest {

	private static final String API = "/api/ai/admin/chat";

	/** A secret part of the key that must never be read back. */
	private static final String SECRET = "Q7xSecretPart";

	private static final String GOOD_KEY = "sk-good-" + SECRET;

	/** What a provider says when it fails; none of it may reach a response. */
	private static final String PROVIDER_TEXT = "account acct_9931 over quota";

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
	private AiModels models;

	@Autowired
	private DocumentPages documents;

	private RestTestClient client;

	private String operator;

	private HttpServer provider;

	/** What the provider was asked: the method, the path and the header that carried the key. */
	private final List<String> asked = new CopyOnWriteArrayList<>();

	@BeforeEach
	void setUp() throws IOException {
		jdbc.sql("update ai_task_model set model_id = null, ocr_provider_id = null, reasoning_effort = null, version = 0")
			.update();
		jdbc.sql("delete from ai_provider where purpose = 'chat'").update();
		jdbc.sql("delete from ai_usage").update();
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
		operator = TestSignIn.session(client, mail, "operator@chat.test");
		provider = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		// An OpenAI-compatible gateway: names its models, and publishes limits and prices for one of them.
		provider.createContext("/v1/models", exchange -> {
			String key = exchange.getRequestHeaders().getFirst("Authorization");
			asked.add("GET /v1/models " + key);
			if (!("Bearer " + GOOD_KEY).equals(key)) {
				answer(exchange, 401, "{\"error\":{\"message\":\"" + PROVIDER_TEXT + "\"}}");
				return;
			}
			answer(exchange, 200, """
					{"data":[
					 {"id":"gpt-5-mini","object":"model","owned_by":"openai"},
					 {"id":"acme/router-large","context_length":50000,"top_provider":{"max_completion_tokens":8000},
					  "supported_parameters":["tools","reasoning"],"architecture":{"input_modalities":["text","image"]},
					  "pricing":{"prompt":"0.000001","completion":"0.000002"}},
					 {"id":"nobody-knows-this"}]}""");
		});
		// Anthropic's own list: another path, another header, nested capability flags and no price.
		provider.createContext("/anthropic/v1/models", exchange -> {
			asked.add("GET /anthropic/v1/models " + exchange.getRequestHeaders().getFirst("x-api-key") + " "
					+ exchange.getRequestHeaders().getFirst("anthropic-version"));
			answer(exchange, 200, """
					{"data":[{"id":"claude-haiku-4-5","max_input_tokens":200000,"max_tokens":64000,
					  "capabilities":{"image_input":{"supported":true},"thinking":{"supported":true}}}],"has_more":false}""");
		});
		// The chat API of the same gateway: it answers OK and says what the call took.
		provider.createContext("/v1/chat/completions", exchange -> {
			String sent = new String(exchange.getRequestBody().readAllBytes(), UTF_8);
			asked.add("POST /v1/chat/completions " + exchange.getRequestHeaders().getFirst("Authorization") + " " + sent);
			answer(exchange, 200, """
					{"id":"chatcmpl-1","object":"chat.completion","created":1,"model":"gpt-5-mini",
					 "choices":[{"index":0,"message":{"role":"assistant","content":"OK"},"finish_reason":"stop"}],
					 "usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15,
					  "prompt_tokens_details":{"cached_tokens":4}}}""");
		});
		provider.createContext("/broken/chat/completions", exchange -> answer(exchange, 500, PROVIDER_TEXT));
		provider.createContext("/down/models", exchange -> answer(exchange, 500, PROVIDER_TEXT));
		provider.createContext("/html/models", exchange -> answer(exchange, 200, "<html>" + PROVIDER_TEXT + "</html>"));
		provider.createContext("/moved/models", exchange -> {
			exchange.getResponseHeaders().add("Location", "http://127.0.0.1:" + provider.getAddress().getPort() + "/stolen");
			answer(exchange, 302, "");
		});
		provider.createContext("/stolen", exchange -> {
			asked.add("STOLEN " + exchange.getRequestHeaders().getFirst("Authorization"));
			answer(exchange, 200, "{\"data\":[]}");
		});
		provider.start();
	}

	@AfterEach
	void stopProvider() {
		provider.stop(0);
	}

	@Test
	void onlyOperatorsSeeOrChangeTheChatSettings() {
		String member = TestSignIn.session(client, mail, "member@chat.test");

		assertProblem(get(member, API), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(send("POST", member, API + "/providers", provider("Gateway", "openai", url("/v1"), GOOD_KEY)), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		assertProblem(send("POST", member, API + "/providers/test", probe(null, "openai", url("/v1"), GOOD_KEY)), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		assertProblem(send("POST", member, API + "/models/" + UUID.randomUUID() + "/test", null), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		assertProblem(send("PUT", member, API + "/tasks/matching", task(null, null, 0)), 403,
				"IDENTITY_OPERATOR_REQUIRED");
	}

	@Test
	void aChatProviderTakesAnyHttpAddressAndItsKeyNeverComesOut() {
		// A self-hosted gateway on a private address over plain http is accepted, as MemoryOS accepts it.
		String body = body(send("POST", operator, API + "/providers", provider("Gateway", "openai", url("/v1"), GOOD_KEY))
			.expectStatus()
			.isOk());

		assertThat(body).doesNotContain(SECRET);
		assertThat(JsonPath.<String>read(body, "$.providers[0].baseUrl")).isEqualTo(url("/v1"));
		assertThat(JsonPath.<Boolean>read(body, "$.providers[0].hasKey")).isTrue();
		assertThat(JsonPath.<List<String>>read(body, "$.adapters")).containsExactly("anthropic", "openai");
		byte[] stored = jdbc.sql("select api_key from ai_provider where purpose = 'chat'").query(byte[].class).single();
		assertThat(new String(stored, UTF_8)).doesNotContain(SECRET);
		assertThat(jdbc.sql("select details::text from audit_event where action = 'ai.provider_create'")
			.query(String.class)
			.list()).containsOnly("{\"vendor\": \"openai\"}");

		// An address never carries credentials, a query or a fragment, it is a web address, and it is not link-local,
		// where a cloud host answers its own credentials.
		for (String bad : List.of("https://user:pass@gateway.test/v1", "https://gateway.test/v1?key=1",
				"https://gateway.test/v1#x", "ftp://gateway.test/v1", "gateway.test/v1", "http://169.254.169.254/v1",
				"http://[fe80::1]/v1", "http://[fd00:ec2::254]/v1")) {
			assertProblem(send("POST", operator, API + "/providers", provider("Bad", "openai", bad, GOOD_KEY)), 400,
					"AI_PROVIDER_ENDPOINT_INVALID");
		}
		assertProblem(send("POST", operator, API + "/providers", provider("Other", "gemini", url("/v1"), GOOD_KEY)), 400,
				"AI_PROVIDER_ADAPTER_UNKNOWN");
		assertProblem(send("POST", operator, API + "/providers", provider("Gateway", "openai", url("/v1"), GOOD_KEY)), 409,
				"AI_PROVIDER_NAME_TAKEN");
	}

	@Test
	void aTestListsTheModelsAndNamesTheFailureWithoutTheProvidersWords() {
		String good = body(send("POST", operator, API + "/providers/test", probe(null, "openai", url("/v1"), GOOD_KEY))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Boolean>read(good, "$.ok")).isTrue();
		assertThat(JsonPath.<Integer>read(good, "$.modelCount")).isEqualTo(3);

		Map<String, String> failures = Map.of(url("/v1") + "|sk-wrong", "rejected", url("/down") + "|" + GOOD_KEY,
				"unreachable", url("/html") + "|" + GOOD_KEY, "incompatible", url("/moved") + "|" + GOOD_KEY,
				"incompatible", "http://127.0.0.1:1/v1|" + GOOD_KEY, "unreachable");
		failures.forEach((where, reason) -> {
			String[] parts = where.split("\\|");
			String failed = body(send("POST", operator, API + "/providers/test", probe(null, "openai", parts[0], parts[1]))
				.expectStatus()
				.isOk());
			assertThat(JsonPath.<Boolean>read(failed, "$.ok")).as(where).isFalse();
			assertThat(JsonPath.<String>read(failed, "$.reason")).as(where).isEqualTo(reason);
			assertThat(failed).doesNotContain(PROVIDER_TEXT).doesNotContain(SECRET);
		});
		// A redirect is not followed, so the key is never sent on to another host.
		assertThat(asked).noneMatch(line -> line.startsWith("STOLEN"));
	}

	@Test
	void modelsComeFromTheProviderAndTheCatalogFillsWhatItLeavesOut() {
		String listed = body(send("POST", operator, API + "/providers/reported-models",
				probe(null, "openai", url("/v1"), GOOD_KEY))
			.expectStatus()
			.isOk());

		// A router's own limits, capabilities and prices are kept: per token becomes per million.
		Map<String, Object> routed = listedModel(listed, "acme/router-large");
		assertThat(routed).containsEntry("contextWindow", 50000)
			.containsEntry("maxOutputTokens", 8000)
			.containsEntry("toolCalling", true)
			.containsEntry("vision", true)
			.containsEntry("reasoning", true)
			.containsEntry("source", "provider");
		assertThat(((Number) routed.get("inputPrice")).doubleValue()).isEqualTo(1.0);
		assertThat(((Number) routed.get("outputPrice")).doubleValue()).isEqualTo(2.0);
		// OpenAI names its models only: the catalog supplies the rest.
		Map<String, Object> named = listedModel(listed, "gpt-5-mini");
		assertThat(named).containsEntry("source", "catalog");
		assertThat(named.get("inputPrice")).isNotNull();
		assertThat(named.get("maxOutputTokens")).isNotNull();
		// A model nobody describes gets a default window and no price, never a guess.
		Map<String, Object> unknown = listedModel(listed, "nobody-knows-this");
		assertThat(unknown).containsEntry("contextWindow", 32000).containsEntry("source", "none");
		assertThat(unknown.get("inputPrice")).isNull();
		assertThat(unknown.get("maxOutputTokens")).isNull();

		assertProblem(send("POST", operator, API + "/providers/reported-models",
				probe(null, "openai", url("/v1"), "sk-wrong")), 400, "AI_PROVIDER_CREDENTIAL_REJECTED");
		assertProblem(send("POST", operator, API + "/providers/reported-models",
				probe(null, "openai", url("/down"), GOOD_KEY)), 503, "AI_PROVIDER_UNREACHABLE");
		assertProblem(send("POST", operator, API + "/providers/reported-models",
				probe(null, "openai", url("/html"), GOOD_KEY)), 400, "AI_PROVIDER_INCOMPATIBLE");
	}

	@Test
	void claudeIsListedThroughAnthropicsOwnApi() {
		// The address may be typed with or without /v1; the key goes in Anthropic's header, not as a bearer token.
		for (String base : List.of(url("/anthropic"), url("/anthropic/v1/"))) {
			String listed = body(send("POST", operator, API + "/providers/reported-models",
					probe(null, "anthropic", base, GOOD_KEY))
				.expectStatus()
				.isOk());
			Map<String, Object> claude = listedModel(listed, "claude-haiku-4-5");
			assertThat(claude).containsEntry("contextWindow", 200000)
				.containsEntry("maxOutputTokens", 64000)
				.containsEntry("vision", true)
				.containsEntry("reasoning", true)
				.containsEntry("source", "provider");
			// Anthropic publishes no price; the catalog knows this model's.
			assertThat(claude.get("inputPrice")).isNotNull();
		}
		assertThat(asked).contains("GET /anthropic/v1/models " + GOOD_KEY + " 2023-06-01");
	}

	@Test
	void aSavedKeyIsUsedOnlyForTheAddressItWasGivenFor() {
		String id = JsonPath.read(body(send("POST", operator, API + "/providers",
				provider("Gateway", "openai", url("/v1"), GOOD_KEY))
			.expectStatus()
			.isOk()), "$.providers[0].id");

		String good = body(send("POST", operator, API + "/providers/test", probe(id, "openai", url("/v1"), null))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Boolean>read(good, "$.ok")).isTrue();

		// Otherwise an operator could point the test at a server of their own and receive the stored key.
		assertProblem(send("POST", operator, API + "/providers/test", probe(id, "openai", url("/stolen"), null)), 400,
				"AI_PROVIDER_KEY_MISSING");
		Map<String, Object> moved = provider("Gateway", "openai", url("/stolen"), null);
		moved.put("key", "keep");
		assertProblem(send("PUT", operator, API + "/providers/" + id, moved), 400, "AI_PROVIDER_KEY_MISSING");
		assertThat(asked).noneMatch(line -> line.startsWith("STOLEN"));
	}

	@Test
	void aTaskUsesAModelOfASwitchedOnProviderAndIsUnsetWhenTheModelGoes() {
		String connected = body(send("POST", operator, API + "/providers",
				provider("Gateway", "openai", url("/v1"), GOOD_KEY))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(connected, "$.providers[0].id");
		assertThat(JsonPath.<Boolean>read(connected, "$.tasks[0].available")).isFalse();
		assertThat(JsonPath.<String>read(connected, "$.tasks[0].reasoningEffort")).isEqualTo("medium");

		String added = body(send("POST", operator, API + "/providers/" + id + "/models",
				Map.of("models", List.of(model("gpt-5-mini", 272000, 128000, 0), model("gpt-5", 272000, 128000, 0))))
			.expectStatus()
			.isOk());
		String mini = JsonPath.<List<String>>read(added, "$.providers[0].models[?(@.modelName=='gpt-5-mini')].id").getFirst();
		assertProblem(send("POST", operator, API + "/providers/" + id + "/models",
				Map.of("models", List.of(model("gpt-5-mini", 272000, 128000, 0)))), 409, "AI_MODEL_NAME_TAKEN");
		assertProblem(send("POST", operator, API + "/providers/" + id + "/models",
				Map.of("models", List.of(model("too-long", 8000, 8000, 0)))), 400, "AI_MODEL_INVALID");

		String chosen = body(send("PUT", operator, API + "/tasks/matching", task(mini, "high", 0)).expectStatus().isOk());
		assertThat(JsonPath.<String>read(chosen, "$.tasks[0].modelId")).isEqualTo(mini);
		assertThat(JsonPath.<String>read(chosen, "$.tasks[0].reasoningEffort")).isEqualTo("high");
		assertThat(JsonPath.<Boolean>read(chosen, "$.tasks[0].available")).isTrue();
		assertThat(JsonPath.<Boolean>read(chosen, "$.providers[0].inUse")).isTrue();
		// A choice made on an old reading is refused.
		assertProblem(send("PUT", operator, API + "/tasks/matching", task(mini, "low", 0)), 409, "AI_TASK_CHANGED");
		assertProblem(send("PUT", operator, API + "/tasks/summaries", task(mini, null, 0)), 404, "AI_TASK_UNKNOWN");

		// Switched off, the provider keeps its key and its models, and the task can no longer run.
		Map<String, Object> off = provider("Gateway", "openai", url("/v1"), null);
		off.put("key", "keep");
		off.put("enabled", false);
		off.put("version", JsonPath.<Integer>read(chosen, "$.providers[0].version"));
		String switchedOff = body(send("PUT", operator, API + "/providers/" + id, off).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(switchedOff, "$.providers[0].hasKey")).isTrue();
		assertThat(JsonPath.<Boolean>read(switchedOff, "$.tasks[0].available")).isFalse();
		int taskVersion = JsonPath.read(switchedOff, "$.tasks[0].version");
		assertProblem(send("PUT", operator, API + "/tasks/matching", task(mini, "low", taskVersion)), 400,
				"AI_MODEL_UNAVAILABLE");

		// Removing the model leaves the task unset rather than pointing at nothing.
		String removed = body(send("DELETE", operator, API + "/models/" + mini, null).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(removed, "$.tasks[0].modelId")).isNull();
		assertThat(JsonPath.<List<String>>read(removed, "$.providers[0].models[*].modelName")).containsExactly("gpt-5");
		String gone = body(send("DELETE", operator, API + "/providers/" + id, null).expectStatus().isOk());
		assertThat(JsonPath.<List<Object>>read(gone, "$.providers")).isEmpty();
		assertThat(jdbc.sql("select count(*) from ai_model").query(Integer.class).single()).isZero();
		assertThat(jdbc.sql("select action from audit_event where action like 'ai.%' order by occurred_at")
			.query(String.class)
			.list()).contains("ai.model_add", "ai.task_model_change", "ai.model_remove", "ai.provider_delete");
	}

	@Test
	void aModelsPriceFollowsTheCatalogUntilAnOperatorSetsOne() {
		String connected = body(send("POST", operator, API + "/providers", provider("Gateway", "openai", url("/v1"), GOOD_KEY))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(connected, "$.providers[0].id");
		// Added with no price, through a router that prefixes the name: the catalog knows gpt-5-mini at 0.25 and 2.
		Map<String, Object> unpriced = model("cx/gpt-5-mini", 272000, 128000, 0);
		unpriced.put("inputPrice", null);
		unpriced.put("outputPrice", null);
		String added = body(send("POST", operator, API + "/providers/" + id + "/models", Map.of("models", List.of(unpriced)))
			.expectStatus()
			.isOk());
		String model = JsonPath.read(added, "$.providers[0].models[0].id");

		assertThat(JsonPath.<Boolean>read(added, "$.providers[0].models[0].priceFromCatalog")).isTrue();
		assertThat(JsonPath.<Double>read(added, "$.providers[0].models[0].inputPrice")).isEqualTo(0.25);
		assertThat(JsonPath.<Double>read(added, "$.providers[0].models[0].cachedInputPrice")).isEqualTo(0.025);
		// Nothing is copied into the row, so a corrected catalog reaches this model at the next deploy.
		assertThat(jdbc.sql("select input_price is null and output_price is null from ai_model").query(Boolean.class).single())
			.isTrue();

		// A call is recorded at the catalog's price.
		send("PUT", operator, API + "/tasks/matching", task(model, "low", JsonPath.<Integer>read(added, "$.tasks[0].version")))
			.expectStatus()
			.isOk();
		try (AiChat chat = models.chat(AiTask.MATCHING, null)) {
			chat.client().prompt().user("Does this solution fit?").call().content();
		}
		assertThat(((Number) jdbc.sql("select input_price from ai_usage").query().singleValue()).doubleValue()).isEqualTo(0.25);

		// A price an operator sets is theirs, and the catalog no longer speaks for the model.
		Map<String, Object> own = model("cx/gpt-5-mini", 272000, 128000, 0);
		own.put("inputPrice", 0.4);
		String set = body(send("PUT", operator, API + "/models/" + model, own).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(set, "$.providers[0].models[0].priceFromCatalog")).isFalse();
		assertThat(JsonPath.<Double>read(set, "$.providers[0].models[0].inputPrice")).isEqualTo(0.4);

		// Saving the catalog's own prices, as the form shows them, returns the model to the catalog.
		Map<String, Object> listed = model("cx/gpt-5-mini", 272000, 128000,
				JsonPath.<Integer>read(set, "$.providers[0].models[0].version"));
		listed.put("cachedInputPrice", 0.025);
		String back = body(send("PUT", operator, API + "/models/" + model, listed).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(back, "$.providers[0].models[0].priceFromCatalog")).isTrue();
		assertThat(jdbc.sql("select input_price is null from ai_model").query(Boolean.class).single()).isTrue();
	}

	private static Map<String, Object> listedModel(String listed, String name) {
		return JsonPath.<List<Map<String, Object>>>read(listed, "$.models[?(@.modelName=='" + name + "')]").getFirst();
	}

	@Test
	void whatReadsDocumentPagesIsNotChosenInTheChatTab() {
		String settings = body(get(operator, API).expectStatus().isOk());

		// The OCR tab holds it, where an OCR service can read pages in a model's place.
		assertThat(JsonPath.<List<String>>read(settings, "$.tasks[*].task")).containsExactly("matching");
		assertProblem(send("PUT", operator, API + "/tasks/document_reading", task(null, "low", 0)), 404, "AI_TASK_UNKNOWN");
	}

	@Test
	void aTaskWithoutAModelDoesNotRun() {
		assertThat(models.available(AiTask.MATCHING)).isFalse();
		assertThatThrownBy(() -> models.chat(AiTask.MATCHING, null)).isInstanceOf(AiException.class)
			.extracting(failure -> ((AiException) failure).errorCode())
			.isEqualTo(AiErrorCode.TASK_NOT_CONFIGURED);
	}

	@Test
	void everyCallIsRecordedWithItsTokensAndThePriceThen() {
		String id = matchingOn(url("/v1"));

		try (AiChat chat = models.chat(AiTask.MATCHING, new AiSubject("use_case", "uc-1"))) {
			assertThat(chat.modelName()).isEqualTo("gpt-5-mini");
			assertThat(chat.client().prompt().user("Does this solution fit?").call().content()).isEqualTo("OK");
		}

		// The model, the key and the task's reasoning level reached the provider.
		String sent = asked.stream().filter(line -> line.startsWith("POST /v1/chat/completions")).findFirst().orElseThrow();
		assertThat(sent).contains("Bearer " + GOOD_KEY, "\"model\":\"gpt-5-mini\"", "\"reasoning_effort\":\"high\"");
		Map<String, Object> row = jdbc.sql("select * from ai_usage").query().singleRow();
		assertThat(row).containsEntry("task", "matching")
			.containsEntry("provider_name", "Gateway")
			.containsEntry("model_name", "gpt-5-mini")
			.containsEntry("input_tokens", 12L)
			.containsEntry("output_tokens", 3L)
			.containsEntry("outcome", "ok")
			.containsEntry("subject_type", "use_case")
			.containsEntry("subject_id", "uc-1");
		assertThat(row.get("provider_id")).hasToString(id);
		assertThat(((Number) row.get("input_price")).doubleValue()).isEqualTo(0.25);
		assertThat(((Number) row.get("output_price")).doubleValue()).isEqualTo(2.0);
		// Nothing the model was asked or answered is kept.
		assertThat(row.toString()).doesNotContain("Does this solution fit").doesNotContain(SECRET);

		// A later price change does not rewrite what this call cost.
		String settings = body(get(operator, API).expectStatus().isOk());
		String model = JsonPath.read(settings, "$.providers[0].models[0].id");
		Map<String, Object> dearer = model("gpt-5-mini", 272000, 128000, JsonPath.<Integer>read(settings, "$.providers[0].models[0].version"));
		dearer.put("inputPrice", 9);
		send("PUT", operator, API + "/models/" + model, dearer).expectStatus().isOk();
		assertThat(((Number) jdbc.sql("select input_price from ai_usage").query().singleValue()).doubleValue()).isEqualTo(0.25);
	}

	@Test
	void aCallThatFailsIsRecordedWithoutTheProvidersWords() {
		matchingOn(url("/broken"));

		try (AiChat chat = models.chat(AiTask.MATCHING, null)) {
			assertThatThrownBy(() -> chat.client().prompt().user("Does this solution fit?").call().content())
				.isInstanceOf(RuntimeException.class);
		}

		Map<String, Object> row = jdbc.sql("select * from ai_usage").query().singleRow();
		assertThat(row).containsEntry("outcome", "failed");
		assertThat((String) row.get("error_type")).isNotBlank();
		assertThat(row.get("input_tokens")).isNull();
		assertThat(row.toString()).doesNotContain(PROVIDER_TEXT);
	}

	@Test
	void anOperatorTriesAModelAndTheCallIsRecordedAsATest() {
		matchingOn(url("/v1"));
		String model = JsonPath.read(body(get(operator, API).expectStatus().isOk()), "$.providers[0].models[0].id");

		String tried = body(send("POST", operator, API + "/models/" + model + "/test", null).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(tried, "$.ok")).isTrue();

		// The model is asked as its provider runs it: the task's reasoning level is not sent.
		String sent = asked.stream().filter(line -> line.startsWith("POST /v1/chat/completions")).findFirst().orElseThrow();
		assertThat(sent).contains("Reply OK.").doesNotContain("reasoning_effort");
		assertThat(jdbc.sql("select task from ai_usage").query(String.class).single()).isEqualTo("model_test");

		assertProblem(send("POST", operator, API + "/models/" + UUID.randomUUID() + "/test", null), 404,
				"AI_MODEL_NOT_FOUND");
	}

	@Test
	void aModelThatDoesNotAnswerFailsItsTestWithoutTheProvidersWords() {
		matchingOn(url("/broken"));
		String model = JsonPath.read(body(get(operator, API).expectStatus().isOk()), "$.providers[0].models[0].id");

		String tried = body(send("POST", operator, API + "/models/" + model + "/test", null).expectStatus().isOk());

		assertThat(JsonPath.<Boolean>read(tried, "$.ok")).isFalse();
		assertThat(tried).doesNotContain(PROVIDER_TEXT);
		assertThat(jdbc.sql("select outcome from ai_usage").query(String.class).single()).isEqualTo("failed");
	}

	@Test
	void aChangedKeyServesTheNextCallWhileACallInFlightKeepsItsClient() {
		String id = matchingOn(url("/v1"));
		try (AiChat before = models.chat(AiTask.MATCHING, null)) {
			// An operator replaces the key while this work still holds its client.
			Map<String, Object> rekeyed = provider("Gateway", "openai", url("/v1"), "sk-second-key");
			rekeyed.put("version", JsonPath.<Integer>read(body(get(operator, API).expectStatus().isOk()), "$.providers[0].version"));
			send("PUT", operator, API + "/providers/" + id, rekeyed).expectStatus().isOk();

			try (AiChat after = models.chat(AiTask.MATCHING, null)) {
				after.client().prompt().user("again").call().content();
			}
			before.client().prompt().user("still running").call().content();
		}

		List<String> keys = asked.stream()
			.filter(line -> line.startsWith("POST /v1/chat/completions"))
			.map(line -> line.split(" ")[3])
			.toList();
		assertThat(keys).containsExactly("sk-second-key", GOOD_KEY);
	}

	/** Connects the gateway at an address, enables one model on it and has matching use it; answers the provider's id. */
	private String matchingOn(String baseUrl) {
		String connected = body(send("POST", operator, API + "/providers", provider("Gateway", "openai", baseUrl, GOOD_KEY))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(connected, "$.providers[0].id");
		String added = body(send("POST", operator, API + "/providers/" + id + "/models",
				Map.of("models", List.of(model("gpt-5-mini", 272000, 128000, 0))))
			.expectStatus()
			.isOk());
		String model = JsonPath.read(added, "$.providers[0].models[0].id");
		int version = JsonPath.read(added, "$.tasks[0].version");
		send("PUT", operator, API + "/tasks/matching", task(model, "high", version)).expectStatus().isOk();
		return id;
	}

	private String url(String path) {
		return "http://127.0.0.1:" + provider.getAddress().getPort() + path;
	}

	private static Map<String, Object> provider(String name, String adapter, String baseUrl, @Nullable String apiKey) {
		Map<String, Object> request = new HashMap<>();
		request.put("name", name);
		request.put("adapterType", adapter);
		request.put("baseUrl", baseUrl);
		request.put("enabled", true);
		request.put("key", "replace");
		request.put("apiKey", apiKey);
		request.put("version", 0);
		return request;
	}

	private static Map<String, Object> probe(@Nullable String providerId, String adapter, String baseUrl,
			@Nullable String apiKey) {
		Map<String, Object> request = new HashMap<>();
		request.put("providerId", providerId);
		request.put("adapterType", adapter);
		request.put("baseUrl", baseUrl);
		request.put("apiKey", apiKey);
		return request;
	}

	private static Map<String, Object> model(String name, int context, int output, long version) {
		Map<String, Object> request = new HashMap<>();
		request.put("modelName", name);
		request.put("displayName", null);
		request.put("contextWindow", context);
		request.put("maxOutputTokens", output);
		request.put("toolCalling", true);
		request.put("vision", false);
		request.put("reasoning", true);
		request.put("inputPrice", 0.25);
		request.put("outputPrice", 2);
		request.put("cachedInputPrice", null);
		request.put("version", version);
		return request;
	}

	private static Map<String, Object> task(@Nullable String modelId, @Nullable String effort, long version) {
		Map<String, Object> request = new HashMap<>();
		request.put("modelId", modelId);
		request.put("reasoningEffort", effort);
		request.put("version", version);
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
