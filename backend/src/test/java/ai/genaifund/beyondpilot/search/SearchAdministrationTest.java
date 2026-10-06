package ai.genaifund.beyondpilot.search;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import com.jayway.jsonpath.JsonPath;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Admin › AI over real HTTP against PostgreSQL: who may use it, a key that goes in and never comes out, a saved key that
 * is never sent to another address, the test a model passes before search embeds with it, and semantic search turned
 * off. The provider is a stand-in that accepts only keys starting with {@code sk-good}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@ai.test")
@Import({ TestcontainersConfiguration.class, SearchAdministrationTest.Provider.class })
class SearchAdministrationTest {

	private static final String API = "/api/search/admin";

	/** A secret part of the key that must never be read back. */
	private static final String SECRET = "Q7xSecretPart";

	/** A key made for this run, so that no key is written in the repository. */
	@DynamicPropertySource
	static void encryptionKey(DynamicPropertyRegistry registry) {
		byte[] key = new byte[32];
		new SecureRandom().nextBytes(key);
		registry.add("beyondpilot.search.embedding.encryption-key", () -> Base64.getEncoder().encodeToString(key));
	}

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private EmbeddingClients clients;

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		jdbc.sql("update search_settings set provider_id = null, model = null, semantic_enabled = true, version = 0")
			.update();
		jdbc.sql("delete from ai_provider").update();
		clients.reload();
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
		operator = TestSignIn.session(client, mail, "operator@ai.test");
	}

	@Test
	void onlyOperatorsSeeOrChangeTheProviders() {
		String member = TestSignIn.session(client, mail, "member@ai.test");

		assertProblem(get(member, API + "/providers"), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(send("POST", member, API + "/providers", provider("OpenRouter", "sk-good-" + SECRET)), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		assertProblem(get(member, API + "/index"), 403, "IDENTITY_OPERATOR_REQUIRED");
	}

	@Test
	void aKeyGoesInSealedAndNeverComesOut() {
		String body = body(send("POST", operator, API + "/providers", provider("OpenRouter", "sk-good-" + SECRET))
			.expectStatus()
			.isOk());

		assertThat(body).doesNotContain(SECRET);
		assertThat(JsonPath.<Boolean>read(body, "$.providers[0].hasKey")).isTrue();
		assertThat(JsonPath.<Boolean>read(body, "$.keysCanBeStored")).isTrue();
		byte[] stored = jdbc.sql("select api_key from ai_provider").query(byte[].class).single();
		assertThat(new String(stored, UTF_8)).doesNotContain(SECRET);
		assertThat(jdbc.sql("select details::text from audit_event where action = 'ai.provider_create'")
			.query(String.class)
			.single()).isEqualTo("{\"vendor\": \"openrouter\"}");
		assertThat(body(get(operator, API + "/providers").expectStatus().isOk())).doesNotContain(SECRET);
	}

	@Test
	void aSavedKeyIsNeverSentToAnotherAddress() {
		String body = body(send("POST", operator, API + "/providers", provider("OpenRouter", "sk-good-" + SECRET))
			.expectStatus()
			.isOk());
		String id = JsonPath.read(body, "$.providers[0].id");

		Map<String, Object> elsewhere = new HashMap<>();
		elsewhere.put("providerId", id);
		elsewhere.put("vendor", "openrouter");
		elsewhere.put("baseUrl", "https://collector.example/v1");
		elsewhere.put("apiKey", null);
		elsewhere.put("model", "openai/text-embedding-3-large");
		assertProblem(send("POST", operator, API + "/providers/test", elsewhere), 400, "SEARCH_PROVIDER_INVALID");

		// Moved to the other vendor, the provider needs that vendor's key: the saved one is not sent to it.
		Map<String, Object> moved = provider("OpenRouter", null);
		moved.put("vendor", "openai");
		moved.put("baseUrl", "https://api.openai.com/v1");
		moved.put("key", "keep");
		assertProblem(send("PUT", operator, API + "/providers/" + id, moved), 400, "SEARCH_PROVIDER_KEY_MISSING");
		Map<String, Object> otherVendor = new HashMap<>(elsewhere);
		otherVendor.put("vendor", "openai");
		otherVendor.put("baseUrl", "https://api.openai.com/v1");
		otherVendor.put("model", "text-embedding-3-large");
		assertProblem(send("POST", operator, API + "/providers/test", otherVendor), 400, "SEARCH_PROVIDER_KEY_MISSING");

		// At its own address the saved key is used.
		elsewhere.put("baseUrl", "https://openrouter.ai/api/v1");
		String test = body(send("POST", operator, API + "/providers/test", elsewhere).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(test, "$.ok")).isTrue();
		assertThat(JsonPath.<Integer>read(test, "$.dimensions")).isEqualTo(1536);
	}

	@Test
	void aModelIsUsedOnlyAfterItEmbedsATestAndItsProviderCannotBeDeletedMeanwhile() {
		String good = JsonPath.read(body(send("POST", operator, API + "/providers",
				provider("OpenRouter", "sk-good-" + SECRET)).expectStatus().isOk()), "$.providers[0].id");
		String bad = JsonPath.<List<String>>read(body(send("POST", operator, API + "/providers",
				provider("Old key", "sk-revoked")).expectStatus().isOk()), "$.providers[?(@.name == 'Old key')].id")
			.get(0);

		assertProblem(send("PUT", operator, API + "/embedding-model", choice(bad, "openai/text-embedding-3-large", 0)),
				400, "SEARCH_MODEL_REJECTED");
		assertProblem(send("PUT", operator, API + "/embedding-model", choice(good, "text-embedding-3-large", 0)), 400,
				"SEARCH_MODEL_UNKNOWN");

		String chosen = body(send("PUT", operator, API + "/embedding-model",
				choice(good, "openai/text-embedding-3-large", 0)).expectStatus().isOk());
		assertThat(JsonPath.<String>read(chosen, "$.embedding.model")).isEqualTo("openai/text-embedding-3-large");
		assertThat(JsonPath.<String>read(chosen, "$.embedding.providerName")).isEqualTo("OpenRouter");
		String state = body(get(operator, API + "/index").expectStatus().isOk());
		assertThat(JsonPath.<String>read(state, "$.semantic.state")).isEqualTo("on");

		assertProblem(send("DELETE", operator, API + "/providers/" + good, null), 409, "SEARCH_PROVIDER_IN_USE");
		send("DELETE", operator, API + "/providers/" + bad, null).expectStatus().isOk();
		// A choice made on settings read before this one is refused.
		assertProblem(send("PUT", operator, API + "/embedding-model", choice(good, "openai/text-embedding-3-small", 0)),
				409, "SEARCH_SETTINGS_CHANGED");
	}

	@Test
	void semanticSearchTurnedOffIsRecordedAndShown() {
		long version = JsonPath.<Number>read(body(get(operator, API + "/index").expectStatus().isOk()),
				"$.settingsVersion").longValue();

		String body = body(send("PUT", operator, API + "/semantic", Map.of("enabled", false, "version", version))
			.expectStatus()
			.isOk());

		assertThat(JsonPath.<String>read(body, "$.semantic.state")).isEqualTo("off");
		assertThat(jdbc.sql("select count(*) from audit_event where action = 'search.semantic_disable'")
			.query(Long.class)
			.single()).isEqualTo(1);
	}

	@Test
	void aProviderIsReachedOnlyAtItsVendorsOwnAddress() {
		for (String address : new String[] { "http://openrouter.ai/api/v1", "https://user:pass@openrouter.ai/api/v1",
				"https://openrouter.ai/api/v1?token=x", "https://169.254.169.254/latest", "https://localhost:8080/v1",
				"https://api.openai.com/v1" }) {
			Map<String, Object> request = provider("OpenRouter", "sk-good-" + SECRET);
			request.put("baseUrl", address);
			assertProblem(send("POST", operator, API + "/providers", request), 400, "SEARCH_PROVIDER_INVALID");
		}
	}

	private static Map<String, Object> provider(String name, @Nullable String apiKey) {
		Map<String, Object> request = new HashMap<>();
		request.put("vendor", "openrouter");
		request.put("name", name);
		request.put("baseUrl", "https://openrouter.ai/api/v1");
		request.put("key", "replace");
		request.put("apiKey", apiKey);
		request.put("version", 0);
		return request;
	}

	private static Map<String, Object> choice(String providerId, String model, long version) {
		return Map.of("providerId", providerId, "model", model, "version", version);
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

	/**
	 * A provider that embeds only with a key starting with {@code sk-good}, and the test mailbox, imported through a class
	 * of this test's own so that the test keeps a Spring context, and with it a database, of its own.
	 */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Provider {

		@Bean
		@Primary
		OpenAiEmbeddings goodKeysOnly() {
			return new OpenAiEmbeddings() {
				@Override
				EmbeddingModel connect(String baseUrl, String apiKey, String model) {
					return new SearchMeaningTest.Topics();
				}

				@Override
				Probe probe(String baseUrl, String apiKey, String model) {
					return apiKey.startsWith("sk-good") ? new Probe(true, model, 1536, 12, null)
							: new Probe(false, model, null, 12, Probe.REJECTED);
				}
			};
		}

	}

}
