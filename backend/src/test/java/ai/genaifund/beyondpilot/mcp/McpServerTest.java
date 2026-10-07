package ai.genaifund.beyondpilot.mcp;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestAppConnection;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import ai.genaifund.beyondpilot.storage.TestUploads;
import com.jayway.jsonpath.JsonPath;
import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientStreamableHttpTransport;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.TextContent;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * The user MCP server over real HTTP, called by the MCP SDK's own client with a token from a real connection: the
 * tools a person's app sees and what they answer, the way an app is told to sign in, and every token, connection,
 * account, protocol version, origin and rate that is refused. The call log keeps no arguments.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "beyondpilot.identity.operator-emails=operator@mcp.test",
				"beyondpilot.identity.oauth.issuer=http://localhost:3000",
				"beyondpilot.mcp.calls-per-caller-per-minute=30" })
@Import({ TestcontainersConfiguration.class, McpServerTest.Mail.class })
class McpServerTest {

	private static final String ISSUER = "http://localhost:3000";

	private static final Duration WAIT = Duration.ofSeconds(10);

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	private String operator;

	/** A word only this test's items carry, so other tests' items never match. */
	private String word;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
		operator = TestSignIn.session(client, mail, "operator@mcp.test");
		word = "zq" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
	}

	@Test
	void anAppSearchesAndReadsWhatBeyondPilotListsAndTheLogKeepsNoArguments() {
		String owner = TestSignIn.session(client, mail, "owner-" + word + "@mcp.test");
		UUID organization = organization(owner, "Revve " + word);
		post(operator, "/api/organization/admin/organizations/" + organization + "/approve", Map.of());
		UUID solution = submittedSolution(owner, "Voice Agent " + word);
		post(operator, "/api/solution/admin/solutions/" + solution + "/approve", null);
		await().atMost(WAIT).until(() -> searchTotal("voice agent " + word) == 1);

		String person = TestSignIn.session(client, mail, "reader-" + word + "@mcp.test");
		String token = TestAppConnection.connect(client, port, person, "mcp.read").access();
		McpSyncClient app = app(token);
		app.initialize();

		assertThat(app.listTools().tools()).extracting(McpSchema.Tool::name).containsExactly("search", "fetch");

		String found = text(app.callTool(McpSchema.CallToolRequest.builder("search")
			.arguments(Map.of("query", "voice agent " + word))
			.build()));
		String id = JsonPath.read(found, "$.results[0].id");
		assertThat(id).startsWith("solution:");
		assertThat(JsonPath.<String>read(found, "$.results[0].title")).isEqualTo("Voice Agent " + word);
		assertThat(JsonPath.<String>read(found, "$.results[0].url")).startsWith(ISSUER + "/solutions/");

		String read = text(app.callTool(McpSchema.CallToolRequest.builder("fetch").arguments(Map.of("id", id)).build()));
		assertThat(JsonPath.<String>read(read, "$.id")).isEqualTo(id);
		assertThat(JsonPath.<String>read(read, "$.text")).contains("Answers calls and chats for insurers.");
		assertThat(JsonPath.<String>read(read, "$.metadata.organization")).isEqualTo("Revve " + word);

		CallToolResult unknown = app.callTool(McpSchema.CallToolRequest.builder("fetch")
			.arguments(Map.of("id", "solution:no-such-" + word))
			.build());
		assertThat(unknown.isError()).isTrue();
		app.closeGracefully();

		List<Map<String, Object>> calls = jdbc.sql("""
				select c.* from mcp_call c join identity_account a on a.id = c.account_id
				where a.email = :email order by c.called_at
				""").param("email", "reader-" + word + "@mcp.test").query().listOfRows();
		assertThat(calls).extracting(row -> row.get("tool") + " " + row.get("outcome"))
			.containsExactly("search ok", "fetch ok", "fetch refused");
		assertThat(calls.getFirst().keySet()).containsExactlyInAnyOrder("id", "called_at", "account_id", "client_id",
				"server", "tool", "outcome", "duration_ms");
	}

	@Test
	void aCallWithoutATokenIsToldWhereToSignIn() {
		client.post()
			.uri("/mcp")
			.contentType(MediaType.APPLICATION_JSON)
			.body("{}")
			.exchange()
			.expectStatus()
			.isUnauthorized()
			.expectHeader()
			.value(HttpHeaders.WWW_AUTHENTICATE, header -> assertThat(header).contains("scope=\"mcp.read\"")
				.contains("resource_metadata=\"" + ISSUER + "/.well-known/oauth-protected-resource/mcp\""));

		client.get()
			.uri("/.well-known/oauth-protected-resource/mcp")
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.resource")
			.isEqualTo(ISSUER + "/mcp")
			.jsonPath("$.authorization_servers[0]")
			.isEqualTo(ISSUER)
			.jsonPath("$.scopes_supported[0]")
			.isEqualTo("mcp.read");
	}

	@Test
	void aTokenForTheOperatorServerARevokedAppOrADisabledAccountIsRefused() {
		String operatorToken = TestAppConnection.connect(client, port, operator, "mcp.research").access();
		assertThat(initialize(operatorToken, null, null)).isEqualTo(401);

		String person = TestSignIn.session(client, mail, "revoker-" + word + "@mcp.test");
		String token = TestAppConnection.connect(client, port, person, "mcp.read").access();
		assertThat(initialize(token, null, null)).isEqualTo(200);
		String app = client.get()
			.uri("/api/identity/apps")
			.cookie(TestSignIn.SESSION_COOKIE, person)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody(String.class)
			.returnResult()
			.getResponseBody();
		assertThat(JsonPath.<String>read(app, "$[0].clientId")).isEqualTo(TestAppConnection.CLIENT);
		assertThat(JsonPath.<List<String>>read(app, "$[0].servers")).containsExactly("user");
		String appId = JsonPath.read(app, "$[0].id");

		// Nobody else can revoke it.
		client.post()
			.uri("/api/identity/apps/" + appId + "/revoke")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.exchange()
			.expectStatus()
			.isNotFound();
		client.post()
			.uri("/api/identity/apps/" + appId + "/revoke")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, person)
			.exchange()
			.expectStatus()
			.isNoContent();
		assertThat(initialize(token, null, null)).isEqualTo(401);

		String disabled = TestSignIn.session(client, mail, "disabled-" + word + "@mcp.test");
		String kept = TestAppConnection.connect(client, port, disabled, "mcp.read").access();
		jdbc.sql("update identity_account set status = 'disabled' where email = :email")
			.param("email", "disabled-" + word + "@mcp.test")
			.update();
		assertThat(initialize(kept, null, null)).isEqualTo(401);
	}

	@Test
	void anUnknownProtocolVersionAForeignPageOrTooManyCallsAreRefused() {
		String person = TestSignIn.session(client, mail, "limited-" + word + "@mcp.test");
		String token = TestAppConnection.connect(client, port, person, "mcp.read").access();

		assertThat(initialize(token, "2099-01-01", null)).isEqualTo(400);
		assertThat(initialize(token, null, "https://attacker.example")).isEqualTo(403);
		assertThat(initialize(token, null, ISSUER)).isEqualTo(200);

		int refused = 0;
		for (int call = 0; call < 31; call++) {
			if (initialize(token, null, null) == 429) {
				refused++;
			}
		}
		assertThat(refused).isPositive();
	}

	/** The status of an {@code initialize} posted with this token, protocol version header and origin. */
	private int initialize(String token, @Nullable String version, @Nullable String origin) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri("/mcp")
			.header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.header(HttpHeaders.ACCEPT, "application/json, text/event-stream")
			.contentType(MediaType.APPLICATION_JSON);
		if (version != null) {
			request = request.header("MCP-Protocol-Version", version);
		}
		if (origin != null) {
			request = request.header(HttpHeaders.ORIGIN, origin);
		}
		return request
			.body("""
					{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25",
					 "capabilities":{},"clientInfo":{"name":"test","version":"1"}}}
					""")
			.exchange()
			.returnResult()
			.getStatus()
			.value();
	}

	private McpSyncClient app(String token) {
		HttpClientStreamableHttpTransport transport = HttpClientStreamableHttpTransport
			.builder("http://localhost:" + port)
			.endpoint("/mcp")
			.httpRequestCustomizer(
					(builder, method, endpoint, body, context) -> builder.header("Authorization", "Bearer " + token))
			.build();
		return McpClient.sync(transport).requestTimeout(Duration.ofSeconds(20)).build();
	}

	private static String text(CallToolResult result) {
		assertThat(result.isError()).isFalse();
		return ((TextContent) result.content().getFirst()).text();
	}

	private int searchTotal(String query) {
		String body = new String(client.get()
			.uri("/api/search?q={q}", query)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8);
		return JsonPath.<Integer>read(body, "$.total");
	}

	private UUID organization(String session, String name) {
		Map<String, Object> request = new HashMap<>(Map.of("name", name, "type", "company", "country", "VN", "teamSize",
				"2_9", "industries", List.of("insurance"), "website", "https://example.test", "description",
				"Assistants for insurers.", "foundedYear", 2021, "jobTitle", "Founder"));
		return UUID.fromString(JsonPath.read(body(client.post()
			.uri("/api/organization/organizations")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.exchange()
			.expectStatus()
			.isCreated()), "$.id"));
	}

	private UUID submittedSolution(String owner, String name) {
		String draft = body(client.post()
			.uri("/api/solution/mine")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", name))
			.exchange()
			.expectStatus()
			.isCreated());
		UUID id = UUID.fromString(JsonPath.read(draft, "$.id"));
		Map<String, Object> request = new HashMap<>();
		request.put("name", name);
		request.put("summary", "Answers calls and chats for insurers.");
		request.put("problemsSolved", null);
		request.put("valueProposition", null);
		request.put("focusAreas", List.of("document_processing"));
		request.put("industries", List.of("insurance"));
		request.put("maturity", "pilot");
		request.put("deployment", List.of("cloud_saas"));
		request.put("website", "https://example.test");
		request.put("demoUrl", null);
		request.put("builtWith", List.of("LangGraph"));
		request.put("languages", List.of());
		request.put("imageFileIds", List.of());
		request.put("listed", true);
		request.put("version", JsonPath.<Number>read(draft, "$.version").longValue());
		request.put("logoFileId", TestUploads.image(client, owner, "solution_logo", "logo.png"));
		request.put("coverFileId", TestUploads.image(client, owner, "solution_image", "cover.png"));
		client.put()
			.uri("/api/solution/mine/" + id)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.exchange()
			.expectStatus()
			.isOk();
		post(owner, "/api/solution/mine/" + id + "/submit", null);
		return id;
	}

	private void post(String session, String path, @Nullable Object body) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session);
		(body == null ? request : request.contentType(MediaType.APPLICATION_JSON).body(body)).exchange()
			.expectStatus()
			.is2xxSuccessful();
	}

	private static String body(RestTestClient.ResponseSpec response) {
		return new String(response.expectBody().returnResult().getResponseBody(), UTF_8);
	}

	/**
	 * The test mailbox, imported through a class of this test's own so that the test keeps a Spring context, and with
	 * it a database, of its own.
	 */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

}
