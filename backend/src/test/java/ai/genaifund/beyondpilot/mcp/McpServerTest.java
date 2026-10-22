package ai.genaifund.beyondpilot.mcp;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestAppConnection;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import ai.genaifund.beyondpilot.storage.TestUploads;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import ai.genaifund.beyondpilot.shared.Workbooks;
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
 * tools a person's app sees and what they answer, published use cases included, the way an app is told to sign in, and every token, connection,
 * account, protocol version, origin and rate that is refused. The call log keeps no arguments.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "beyondpilot.identity.operator-emails=operator@mcp.test",
				"beyondpilot.identity.oauth.issuer=http://localhost:3000",
				"beyondpilot.mcp.calls-per-caller-per-minute=200" })
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
		organization(owner, "Revve " + word);
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
		// No column holds what was asked or answered: a call keeps only the one record it read, by name and page.
		assertThat(calls.getFirst().keySet()).containsExactlyInAnyOrder("id", "called_at", "account_id", "client_id",
				"server", "tool", "outcome", "duration_ms", "target_kind", "target_id", "target_label", "target_path");
		assertThat(calls).extracting(row -> row.get("target_label"))
			.containsExactly(null, "Voice Agent " + word, null);
		assertThat((String) calls.get(1).get("target_path")).startsWith("/solutions/");
	}

	@Test
	void anOperatorsAppReadsAccountsTheAuditLogEmailAndMatchingAndTheLogNamesTheEmailRead() {
		String email = "mailed-" + word + "@mcp.test";
		String owner = TestSignIn.session(client, mail, email);
		organization(owner, "Mailed " + word);
		UUID solution = submittedSolution(owner, "Mailed Agent " + word);
		post(operator, "/api/solution/admin/solutions/" + solution + "/approve", null);

		String token = TestAppConnection.connect(client, port, operator, "mcp.research").access();
		McpSyncClient app = app(token, "/mcp/operator");
		app.initialize();

		String accounts = text(call(app, "list_accounts", Map.of("q", "mailed-" + word)));
		assertThat(JsonPath.<Integer>read(accounts, "$.total")).isEqualTo(1);
		assertThat(JsonPath.<String>read(accounts, "$.accounts[0].email")).isEqualTo(email);
		assertThat(JsonPath.<String>read(accounts, "$.accounts[0].role")).isEqualTo("user");
		assertThat(call(app, "list_accounts", Map.of("role", "owner")).isError()).isTrue();

		String audit = text(call(app, "list_audit_events", Map.of("action", "solution.approve", "q", word)));
		assertThat(JsonPath.<List<String>>read(audit, "$.events[*].resource.name")).containsExactly("Mailed Agent " + word);
		assertThat(JsonPath.<String>read(audit, "$.events[0].actor")).contains("operator@mcp.test");
		assertThat(call(app, "list_audit_events", Map.of("before", "not-a-cursor")).isError()).isTrue();

		String sent = text(call(app, "list_emails", Map.of("q", email, "kind", "solution_approved")));
		assertThat(JsonPath.<List<Object>>read(sent, "$.emails")).hasSize(1);
		assertThat(JsonPath.<Integer>read(sent, "$.counts.total")).isPositive();
		String id = JsonPath.read(sent, "$.emails[0].id");
		String subject = JsonPath.read(sent, "$.emails[0].subject");

		String read = text(call(app, "get_email", Map.of("email", id)));
		assertThat(JsonPath.<String>read(read, "$.recipient")).isEqualTo(email);
		assertThat(JsonPath.<String>read(read, "$.text")).contains("Mailed Agent " + word);
		assertThat(JsonPath.<Map<String, Object>>read(read, "$")).doesNotContainKey("html");
		String withHtml = text(call(app, "get_email", Map.of("email", id, "detail", true)));
		assertThat(JsonPath.<String>read(withHtml, "$.html")).contains("<");

		// A sign-in code still signs in for minutes: neither its subject nor its body leaves BeyondPilot.
		String codes = text(call(app, "list_emails", Map.of("q", email, "kind", "sign_in_code")));
		assertThat(JsonPath.<List<String>>read(codes, "$.emails[*].subject")).isNotEmpty()
			.allMatch("A sign-in code"::equals);
		String code = text(call(app, "get_email", Map.of("email", JsonPath.read(codes, "$.emails[0].id"))));
		assertThat(JsonPath.<Map<String, Object>>read(code, "$")).doesNotContainKeys("text", "html");
		assertThat(code).doesNotContain(mail.latestCodeTo(email));
		// Nor can a search by its digits find it.
		String digits = text(call(app, "list_emails", Map.of("q", mail.latestCodeTo(email), "kind", "sign_in_code")));
		assertThat(JsonPath.<List<Object>>read(digits, "$.emails")).isEmpty();

		assertThat(JsonPath.<Integer>read(text(call(app, "list_matching_runs", Map.of())), "$.page")).isEqualTo(1);
		assertThat(call(app, "get_matching_run", Map.of("run", UUID.randomUUID().toString())).isError()).isTrue();
		assertThat(call(app, "get_matches", Map.of("use_case", UUID.randomUUID().toString())).isError()).isTrue();
		app.closeGracefully();

		List<Map<String, Object>> reads = jdbc.sql("""
				select target_kind, target_id, target_label, target_path from mcp_call
				where tool = 'get_email' and target_id = :id
				""").param("id", id).query().listOfRows();
		assertThat(reads).hasSize(2).allSatisfy(row -> assertThat(row).containsEntry("target_kind", "email")
			.containsEntry("target_label", subject + " → " + email)
			.containsEntry("target_path", "/admin/email/activity/" + id));
	}

	private static CallToolResult call(McpSyncClient app, String tool, Map<String, Object> arguments) {
		return app.callTool(McpSchema.CallToolRequest.builder(tool).arguments(arguments).build());
	}

	@Test
	void operatorsSeeEveryCallAndEveryConnectionAndRevokeOne() {
		String email = "watched-" + word + "@mcp.test";
		String person = TestSignIn.session(client, mail, email);
		String token = TestAppConnection.connect(client, port, person, "mcp.read").access();
		McpSyncClient app = app(token);
		app.initialize();
		app.callTool(McpSchema.CallToolRequest.builder("search").arguments(Map.of("query", "anything")).build());
		app.callTool(McpSchema.CallToolRequest.builder("fetch")
			.arguments(Map.of("id", "solution:no-such-" + word))
			.build());
		app.closeGracefully();

		// Only operators read the activity.
		client.get()
			.uri("/api/mcp/admin/calls")
			.cookie(TestSignIn.SESSION_COOKIE, person)
			.exchange()
			.expectStatus()
			.isForbidden();
		String all = adminGet("/api/mcp/admin/calls?q=watched-" + word);
		assertThat(JsonPath.<Integer>read(all, "$.total")).isEqualTo(2);
		assertThat(JsonPath.<List<String>>read(all, "$.items[*].tool")).containsExactly("fetch", "search");
		assertThat(JsonPath.<String>read(all, "$.items[0].outcome")).isEqualTo("refused");
		assertThat(JsonPath.<String>read(all, "$.items[0].personEmail")).isEqualTo(email);
		assertThat(JsonPath.<String>read(all, "$.items[0].clientId")).isEqualTo(TestAppConnection.CLIENT);
		assertThat(JsonPath.<List<String>>read(all, "$.apps[*].clientId")).contains(TestAppConnection.CLIENT);
		assertThat(JsonPath.<List<String>>read(all, "$.tools")).containsExactly("search", "fetch", "list_applications",
				"get_application", "read_application_file", "list_pending_reviews", "list_records", "get_record", "list_proposals", "get_proposal", "list_programs", "get_program",
				"list_accounts", "list_audit_events", "list_emails", "get_email", "list_matching_runs",
				"get_matching_run", "get_matches", "decide_record", "decide_application", "decide_proposal", "score_application", "create_organization", "create_use_case",
				"update_use_case", "publish_use_case", "send_back_use_case", "set_use_case_programs");
		assertThat(JsonPath.<Integer>read(adminGet("/api/mcp/admin/calls?q=watched-" + word + "&outcome=refused"),
				"$.total")).isEqualTo(1);
		assertThat(JsonPath.<Integer>read(adminGet("/api/mcp/admin/calls?q=watched-" + word + "&tool=search"),
				"$.total")).isEqualTo(1);
		assertThat(JsonPath.<Integer>read(adminGet("/api/mcp/admin/calls?q=nobody-matches-" + word), "$.total"))
			.isZero();

		// The download holds the calls the filters select, newest first, and is recorded; nobody else downloads them.
		String export = "/api/mcp/admin/calls/export?q=watched-" + word;
		client.post()
			.uri(export)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, person)
			.exchange()
			.expectStatus()
			.isForbidden();
		List<List<String>> sheet = Workbooks.rows(client.post()
			.uri(export)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.exchange()
			.expectStatus()
			.isOk()
			.expectHeader()
			.contentType(SpreadsheetFormat.XLSX_TYPE)
			.expectBody()
			.returnResult()
			.getResponseBody());
		assertThat(sheet).hasSize(3);
		assertThat(sheet.get(0)).startsWith("Called at", "Person", "Email", "App", "Server", "Tool", "Outcome");
		assertThat(sheet.get(1)).contains(email, "fetch", "Refused");
		assertThat(sheet.get(2)).contains(email, "search", "Ok");
		String csv = new String(client.post()
			.uri(export + "&format=csv&outcome=refused")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8);
		assertThat(csv).startsWith("\uFEFFCalled at,Person,Email,App,Server,Tool,Outcome,");
		assertThat(csv.lines().toList()).hasSize(2);
		assertThat(jdbc.sql("select details ->> 'count' from audit_event where action = 'mcp.calls_export' order by occurred_at")
			.query(String.class)
			.list()).containsExactly("2", "1");

		// Operators see the connection and end it; the app is refused at its next call.
		client.get()
			.uri("/api/identity/admin/apps")
			.cookie(TestSignIn.SESSION_COOKIE, person)
			.exchange()
			.expectStatus()
			.isForbidden();
		String connections = adminGet("/api/identity/admin/apps");
		List<Map<String, Object>> mine = JsonPath.read(connections, "$[?(@.personEmail == '" + email + "')]");
		assertThat(mine).hasSize(1);
		assertThat(mine.getFirst()).containsEntry("servers", List.of("user")).containsEntry("operator", false);
		String revoke = "/api/identity/admin/apps/" + mine.getFirst().get("accountId") + "/" + mine.getFirst().get("id")
				+ "/revoke";
		post(operator, revoke, null);
		assertThat(initialize(token, null, null)).isEqualTo(401);
		client.post()
			.uri(revoke)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.exchange()
			.expectStatus()
			.isNotFound();
		assertThat(jdbc.sql("""
				select actor_email || ' ' || resource_label from audit_event
				where action = 'mcp.app_revoke' and resource_label like :label
				""").param("label", "% · " + email).query(String.class).list()).hasSize(1);
	}

	private String adminGet(String path) {
		return body(client.get().uri(path).cookie(TestSignIn.SESSION_COOKIE, operator).exchange().expectStatus().isOk());
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

		// Someone who has not connected the app has nothing to revoke: a revoke ends only the caller's own connections.
		String stranger = TestSignIn.session(client, mail, "stranger-" + word + "@mcp.test");
		client.post()
			.uri("/api/identity/apps/" + appId + "/revoke")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, stranger)
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
	void anAccountWithoutThePlatformConsentIsRefusedAndToldWhereToAgree() {
		String person = TestSignIn.session(client, mail, "withdrawn-" + word + "@mcp.test");
		String token = TestAppConnection.connect(client, port, person, "mcp.read").access();
		assertThat(initialize(token, null, null)).isEqualTo(200);

		client.put()
			.uri("/api/identity/consent")
			.cookie(TestSignIn.SESSION_COOKIE, person)
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("platform", false, "partners", true, "ai", true, "updates", true, "source", "settings"))
			.exchange()
			.expectStatus()
			.isOk();

		client.post()
			.uri("/mcp")
			.header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.header(HttpHeaders.ACCEPT, "application/json, text/event-stream")
			.contentType(MediaType.APPLICATION_JSON)
			.body("""
					{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25",
					 "capabilities":{},"clientInfo":{"name":"test","version":"1"}}}
					""")
			.exchange()
			.expectStatus()
			.isUnauthorized()
			.expectHeader()
			.value(HttpHeaders.WWW_AUTHENTICATE,
					header -> assertThat(header).contains("invalid_token").contains(ISSUER + "/consent"));
	}

	@Test
	void anUnknownProtocolVersionAForeignPageOrTooManyCallsAreRefused() {
		String person = TestSignIn.session(client, mail, "limited-" + word + "@mcp.test");
		String token = TestAppConnection.connect(client, port, person, "mcp.read").access();

		assertThat(initialize(token, "2099-01-01", null)).isEqualTo(400);
		assertThat(initialize(token, null, "https://attacker.example")).isEqualTo(403);
		assertThat(initialize(token, null, ISSUER)).isEqualTo(200);

		// The limit refills as calls go, so calls are made until one is refused.
		int refused = 0;
		for (int call = 0; call < 1000 && refused == 0; call++) {
			if (initialize(token, null, null) == 429) {
				refused++;
			}
		}
		assertThat(refused).isPositive();
	}

	@Test
	void anAppFindsAndReadsAPublishedUseCaseButNotOneThatIsNot() {
		String owner = TestSignIn.session(client, mail, "poster-" + word + "@mcp.test");
		UUID organization = organization(owner, "Fleet " + word);
		UUID published = useCase(organization, "Invoice matcher " + word, true);
		UUID draft = useCase(organization, "Invoice draft " + word, false);
		await().atMost(WAIT)
			.until(() -> jdbc.sql("select count(*) from search_document where item_id = :id")
				.param("id", published)
				.query(Long.class)
				.single() == 1);

		String person = TestSignIn.session(client, mail, "builder-" + word + "@mcp.test");
		McpSyncClient app = app(TestAppConnection.connect(client, port, person, "mcp.read").access());
		app.initialize();

		String found = text(app.callTool(McpSchema.CallToolRequest.builder("search")
			.arguments(Map.of("query", "invoice matcher " + word))
			.build()));
		assertThat(JsonPath.<String>read(found, "$.results[0].id")).isEqualTo("use_case:" + published);
		assertThat(JsonPath.<String>read(found, "$.results[0].url")).isEqualTo(ISSUER + "/use-cases/" + published);

		String read = text(app.callTool(McpSchema.CallToolRequest.builder("fetch")
			.arguments(Map.of("id", "use_case:" + published))
			.build()));
		assertThat(JsonPath.<String>read(read, "$.title")).isEqualTo("Invoice matcher " + word);
		assertThat(JsonPath.<String>read(read, "$.text")).contains("Fleet " + word, "Cut hotline calls by 40%.")
			// The problem statement is for members on the site, not for search.
			.doesNotContain("checks vehicle documents by hand");
		assertThat(JsonPath.<String>read(read, "$.metadata.kind")).isEqualTo("use_case");

		// A use case not published is no more found or read here than on the site.
		assertThat(app.callTool(McpSchema.CallToolRequest.builder("fetch")
			.arguments(Map.of("id", "use_case:" + draft))
			.build()).isError()).isTrue();
		app.closeGracefully();

		Map<String, Object> logged = jdbc.sql("""
				select c.* from mcp_call c join identity_account a on a.id = c.account_id
				where a.email = :email and c.tool = 'fetch' and c.outcome = 'ok'
				""").param("email", "builder-" + word + "@mcp.test").query().singleRow();
		assertThat(logged.get("target_path")).isEqualTo("/use-cases/" + published);
	}

	@Test
	void anOperatorsAppSearchesEveryAreaIncludingWhatIsUnlistedAndAUserTokenIsRefused() {
		String owner = TestSignIn.session(client, mail, "owner-" + word + "@mcp.test");
		organization(owner, "Quiet " + word);
		UUID solution = submittedSolution(owner, "Hidden Agent " + word, false);
		post(operator, "/api/solution/admin/solutions/" + solution + "/approve", null);
		await().atMost(WAIT)
			.until(() -> jdbc.sql("select count(*) from search_document where item_id = :id")
				.param("id", solution)
				.query(Long.class)
				.single() == 1);

		String token = TestAppConnection.connect(client, port, operator, "mcp.research").access();
		McpSyncClient app = app(token, "/mcp/operator");
		app.initialize();
		assertThat(app.listTools().tools()).extracting(McpSchema.Tool::name)
			.containsExactly("search", "fetch", "list_applications", "get_application",
					"read_application_file", "list_pending_reviews", "list_records", "get_record", "list_proposals", "get_proposal", "list_programs", "get_program", "list_accounts",
					"list_audit_events", "list_emails", "get_email", "list_matching_runs", "get_matching_run",
					"get_matches", "decide_record", "decide_application", "decide_proposal", "score_application", "create_organization", "create_use_case",
				"update_use_case", "publish_use_case", "send_back_use_case", "set_use_case_programs");

		String found = text(app.callTool(McpSchema.CallToolRequest.builder("search")
			.arguments(Map.of("query", "hidden agent " + word))
			.build()));
		String solutionId = JsonPath.read(found, "$.results[0].id");
		assertThat(solutionId).startsWith("solution:");
		String read = text(
				app.callTool(McpSchema.CallToolRequest.builder("fetch").arguments(Map.of("id", solutionId)).build()));
		assertThat(JsonPath.<Boolean>read(read, "$.metadata.listed")).isFalse();

		String companies = text(app.callTool(McpSchema.CallToolRequest.builder("search")
			.arguments(Map.of("query", "Quiet " + word))
			.build()));
		assertThat(JsonPath.<List<String>>read(companies, "$.results[*].id")).anyMatch(id -> id.startsWith("organization:"));
		app.closeGracefully();

		// What only operators read stays out of the user server.
		String person = TestSignIn.session(client, mail, "visitor-" + word + "@mcp.test");
		String userToken = TestAppConnection.connect(client, port, person, "mcp.read").access();
		McpSyncClient visitor = app(userToken);
		visitor.initialize();
		String nothing = text(visitor.callTool(McpSchema.CallToolRequest.builder("search")
			.arguments(Map.of("query", "hidden agent " + word))
			.build()));
		// Other tests' listed solutions may match the words; the hidden one never does.
		assertThat(JsonPath.<List<String>>read(nothing, "$.results[*].id")).doesNotContain(solutionId);
		CallToolResult refused = visitor.callTool(
				McpSchema.CallToolRequest.builder("fetch").arguments(Map.of("id", solutionId)).build());
		assertThat(refused.isError()).isTrue();
		visitor.closeGracefully();

		// A token for the user server does not open the operators' one.
		assertThat(initializeAt("/mcp/operator", userToken)).isEqualTo(401);
	}

	@Test
	void anOperatorsAppListsWhatWaitsForReviewWithThePageToReviewItOn() {
		String owner = TestSignIn.session(client, mail, "waiting-" + word + "@mcp.test");
		organization(owner, "Waiting " + word);
		UUID solution = submittedSolution(owner, "Pending Agent " + word);

		String token = TestAppConnection.connect(client, port, operator, "mcp.research").access();
		McpSyncClient app = app(token, "/mcp/operator");
		app.initialize();
		String all = text(app.callTool(McpSchema.CallToolRequest.builder("list_pending_reviews").build()));
		assertThat(JsonPath.<List<String>>read(all, "$.solutions.items[*].name")).contains("Pending Agent " + word);
		assertThat(JsonPath.<List<String>>read(all, "$.solutions.items[*].url"))
			.contains(ISSUER + "/admin/solutions/" + solution);
		assertThat(JsonPath.<Integer>read(all, "$.waiting")).isPositive();
		assertThat(JsonPath.<Map<String, Object>>read(all, "$")).containsKeys("talent", "use_cases", "deployments");

		String solutions = text(app.callTool(McpSchema.CallToolRequest.builder("list_pending_reviews")
			.arguments(Map.of("area", "solutions"))
			.build()));
		assertThat(JsonPath.<Map<String, Object>>read(solutions, "$")).containsOnlyKeys("waiting", "solutions");
		assertThat(app.callTool(McpSchema.CallToolRequest.builder("list_pending_reviews")
			.arguments(Map.of("area", "everything"))
			.build()).isError()).isTrue();
		app.closeGracefully();
	}

	@Test
	void listPendingReviewsListsNoOrganizations() {
		String token = TestAppConnection.connect(client, port, operator, "mcp.research").access();
		McpSyncClient app = app(token, "/mcp/operator");
		app.initialize();

		String all = text(app.callTool(McpSchema.CallToolRequest.builder("list_pending_reviews").build()));
		assertThat(JsonPath.<Map<String, Object>>read(all, "$")).doesNotContainKey("organizations");
		CallToolResult organizations = app.callTool(McpSchema.CallToolRequest.builder("list_pending_reviews")
			.arguments(Map.of("area", "organizations"))
			.build());
		assertThat(organizations.isError()).isTrue();
		assertThat(JsonPath.<List<String>>read(operatorTool(app, "list_pending_reviews").inputSchema(),
				"$.properties.area.enum"))
			.containsExactly("solutions", "talent", "use_cases", "deployments");
		app.closeGracefully();
	}

	@Test
	void anOperatorsAppListsRecordsOfAnyStatusAndReadsOneWithItsHistory() {
		String owner = TestSignIn.session(client, mail, "records-" + word + "@mcp.test");
		UUID organization = organization(owner, "Records " + word);
		UUID sentBack = submittedSolution(owner, "Claims Agent " + word);
		UUID waiting = submittedSolution(owner, "Quotes Agent " + word);
		post(operator, "/api/solution/admin/solutions/" + sentBack + "/send-back",
				Map.of("reason", "Name a customer it serves."));

		String token = TestAppConnection.connect(client, port, operator, "mcp.research").access();
		McpSyncClient app = app(token, "/mcp/operator");
		app.initialize();

		String needsChanges = text(app.callTool(McpSchema.CallToolRequest.builder("list_records")
			.arguments(Map.of("area", "solutions", "status", "needs_changes", "q", word))
			.build()));
		assertThat(JsonPath.<Integer>read(needsChanges, "$.total")).isEqualTo(1);
		assertThat(JsonPath.<String>read(needsChanges, "$.items[0].id")).isEqualTo(sentBack.toString());
		assertThat(JsonPath.<String>read(needsChanges, "$.items[0].status")).isEqualTo("needs_changes");
		assertThat(JsonPath.<String>read(needsChanges, "$.items[0].organizationName")).isEqualTo("Records " + word);
		assertThat(JsonPath.<String>read(needsChanges, "$.items[0].url"))
			.isEqualTo(ISSUER + "/admin/solutions/" + sentBack);

		String first = text(app.callTool(McpSchema.CallToolRequest.builder("list_records")
			.arguments(Map.of("area", "solutions", "q", word, "size", 1))
			.build()));
		assertThat(JsonPath.<Integer>read(first, "$.total")).isEqualTo(2);
		assertThat(JsonPath.<Integer>read(first, "$.nextPage")).isEqualTo(2);
		String second = text(app.callTool(McpSchema.CallToolRequest.builder("list_records")
			.arguments(Map.of("area", "solutions", "q", word, "size", 1, "page", 2))
			.build()));
		assertThat(JsonPath.<Object>read(second, "$.nextPage")).isNull();
		assertThat(List.of(JsonPath.<String>read(first, "$.items[0].id"), JsonPath.<String>read(second, "$.items[0].id")))
			.containsExactlyInAnyOrder(sentBack.toString(), waiting.toString());
		assertThat(app.callTool(McpSchema.CallToolRequest.builder("list_records")
			.arguments(Map.of("area", "talent", "status", "rejected"))
			.build()).isError()).isTrue();

		String record = text(app.callTool(McpSchema.CallToolRequest.builder("get_record")
			.arguments(Map.of("area", "solutions", "id", sentBack.toString()))
			.build()));
		assertThat(JsonPath.<String>read(record, "$.status")).isEqualTo("needs_changes");
		assertThat(JsonPath.<String>read(record, "$.decisionMessage")).isEqualTo("Name a customer it serves.");
		assertThat(JsonPath.<String>read(record, "$.url")).isEqualTo(ISSUER + "/admin/solutions/" + sentBack);
		assertThat(JsonPath.<String>read(record, "$.history[0].action")).isEqualTo("solution.send_back");
		assertThat(JsonPath.<String>read(record, "$.history[0].by")).isNotBlank();
		assertThat(JsonPath.<Map<String, Object>>read(record, "$")).doesNotContainKey("focusAreas");
		String full = text(app.callTool(McpSchema.CallToolRequest.builder("get_record")
			.arguments(Map.of("area", "solutions", "id", sentBack.toString(), "detail", true))
			.build()));
		assertThat(JsonPath.<List<String>>read(full, "$.focusAreas")).containsExactly("document_processing");
		assertThat(JsonPath.<String>read(full, "$.decisionMessage")).isEqualTo("Name a customer it serves.");
		String company = text(app.callTool(McpSchema.CallToolRequest.builder("get_record")
			.arguments(Map.of("area", "organizations", "id", organization.toString()))
			.build()));
		assertThat(JsonPath.<String>read(company, "$.status")).isEqualTo("active");
		assertThat(app.callTool(McpSchema.CallToolRequest.builder("get_record")
			.arguments(Map.of("area", "talent", "id", sentBack.toString()))
			.build()).isError()).isTrue();
		app.closeGracefully();

		List<String> read = jdbc.sql("""
				select target_kind || ' ' || target_label || ' ' || target_path from mcp_call
				where tool = 'get_record' and outcome = 'ok' and target_id = :id
				""").param("id", sentBack.toString()).query(String.class).list();
		assertThat(read).hasSize(2)
			.allMatch(row -> row.equals("solution Claims Agent " + word + " /admin/solutions/" + sentBack));
	}

	@Test
	void anOperatorsAppApprovesAndSendsBackWhatWaitsForReviewAsTheAdminScreenDoes() {
		String token = TestAppConnection.connect(client, port, operator, "mcp.research").access();
		McpSyncClient app = app(token, "/mcp/operator");
		app.initialize();

		List<McpSchema.Tool> tools = app.listTools().tools();
		McpSchema.Tool decide = tools.stream().filter(tool -> tool.name().equals("decide_record")).findFirst().orElseThrow();
		assertThat(decide.annotations().readOnlyHint()).isFalse();
		assertThat(decide.annotations().destructiveHint()).isTrue();
		McpSchema.Tool quiet = tools.stream().filter(tool -> tool.name().equals("decide_proposal")).findFirst().orElseThrow();
		assertThat(quiet.annotations().readOnlyHint()).isFalse();
		assertThat(quiet.annotations().destructiveHint()).isFalse();

		String ownerMail = "approved-" + word + "@mcp.test";
		String other = TestSignIn.session(client, mail, ownerMail);
		organization(other, "Approved " + word);

		// A send back needs the words the owners read.
		UUID sentBack = submittedSolution(other, "Sent Back Agent " + word);
		assertThat(decide(app, Map.of("area", "solutions", "id", sentBack.toString(), "action", "send_back")).isError())
			.isTrue();
		String returned = text(decide(app, Map.of("area", "solutions", "id", sentBack.toString(), "action",
				"send_back", "message", "Name a customer it serves.")));
		assertThat(JsonPath.<String>read(returned, "$.before")).isEqualTo("in_review");
		assertThat(JsonPath.<String>read(returned, "$.after")).isEqualTo("needs_changes");
		assertThat(JsonPath.<String>read(returned, "$.told")).isEqualTo("1 member of Approved " + word + ", by email.");
		await().atMost(WAIT)
			.untilAsserted(() -> assertThat(mail.latestTextTo(ownerMail)).contains("Name a customer it serves."));

		// Not in review: refused with what to do instead.
		CallToolResult refused = decide(app,
				Map.of("area", "solutions", "id", sentBack.toString(), "action", "approve"));
		assertThat(refused.isError()).isTrue();
		assertThat(((TextContent) refused.content().getFirst()).text()).contains("get_record");

		UUID solution = submittedSolution(other, "Decided Agent " + word);
		assertThat(decide(app, Map.of("area", "solutions", "id", solution.toString(), "action", "reject")).isError())
			.isTrue();
		String listed = text(decide(app, Map.of("area", "solutions", "id", solution.toString(), "action", "approve")));
		assertThat(JsonPath.<String>read(listed, "$.before")).isEqualTo("in_review");
		assertThat(JsonPath.<String>read(listed, "$.after")).isEqualTo("approved");
		app.closeGracefully();

		assertThat(jdbc.sql("""
				select target_kind || ' ' || outcome from mcp_call where tool = 'decide_record' and target_id = :id
				""").param("id", sentBack.toString()).query(String.class).list()).containsExactly("solution ok");
	}

	@Test
	void decideRecordRefusesAnOrganization() {
		UUID organization = organization(TestSignIn.session(client, mail, "decided-" + word + "@mcp.test"),
				"Decided " + word);
		String token = TestAppConnection.connect(client, port, operator, "mcp.research").access();
		McpSyncClient app = app(token, "/mcp/operator");
		app.initialize();

		assertThat(JsonPath.<List<String>>read(operatorTool(app, "decide_record").inputSchema(), "$.properties.area.enum"))
			.containsExactly("solutions", "talent", "deployments");
		for (String action : List.of("approve", "send_back")) {
			CallToolResult refused = decide(app,
					Map.of("area", "organizations", "id", organization.toString(), "action", action));
			assertThat(refused.isError()).isTrue();
		}
		app.closeGracefully();
	}

	@Test
	void anOperatorsAppKeepsAUseCasePrivateFromItsCompanyUntilItPublishesIt() {
		String owner = TestSignIn.session(client, mail, "private-" + word + "@mcp.test");
		UUID organization = organization(owner, "Private " + word);
		String token = TestAppConnection.connect(client, port, operator, "mcp.research").access();
		McpSyncClient app = app(token, "/mcp/operator");
		app.initialize();

		// A company of the same name is not made twice; a new one is active and owned by nobody.
		CallToolResult twice = call(app, "create_organization", Map.of("name", "private " + word, "type", "company"));
		assertThat(twice.isError()).isTrue();
		assertThat(((TextContent) twice.content().getFirst()).text()).contains(organization.toString());
		String created = text(call(app, "create_organization",
				Map.of("name", "Harbour " + word, "type", "company", "country", "VN", "industries", List.of("logistics"))));
		assertThat(JsonPath.<String>read(created, "$.status")).isEqualTo("active");
		assertThat(call(app, "create_organization", Map.of("name", "Bad " + word, "type", "company", "country", "Vietnam"))
			.isError()).isTrue();

		Map<String, Object> brief = new HashMap<>();
		brief.put("organization", organization.toString());
		brief.put("title", "Claims triage " + word);
		brief.put("problem_statement", "Adjusters sort claim files by hand.");
		brief.put("industry", "insurance");
		brief.put("expected_outcomes", "Half the sorting time.");
		brief.put("budget_to_be_determined", true);
		brief.put("requirements", List.of(Map.of("statement", "Reads scanned PDFs", "required", true)));
		brief.put("closes_at", "2099-12-31");
		String draft = text(call(app, "create_use_case", brief));
		UUID id = UUID.fromString(JsonPath.read(draft, "$.id"));
		assertThat(JsonPath.<String>read(draft, "$.status")).isEqualTo("draft");
		assertThat(JsonPath.<Boolean>read(draft, "$.private")).isTrue();
		Map<String, Object> noProblem = new HashMap<>(brief);
		noProblem.remove("problem_statement");
		assertThat(((TextContent) call(app, "create_use_case", noProblem).content().getFirst()).text())
			.contains("problem_statement");

		// Its company's members neither list, read, change nor send it.
		assertThat(body(client.get()
			.uri("/api/usecase/mine")
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.exchange()
			.expectStatus()
			.isOk())).doesNotContain(id.toString());
		client.get()
			.uri("/api/usecase/mine/" + id)
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.exchange()
			.expectStatus()
			.isNotFound();
		client.post()
			.uri("/api/usecase/mine/" + id + "/submit")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.exchange()
			.expectStatus()
			.isNotFound();

		// Filed under a program by its slug, then under none; an unknown program is refused.
		String program = JsonPath.read(body(client.post()
			.uri("/api/program/admin/programs")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", "Claims Challenge " + word, "slug", "claims-" + word, "type", "enterprise_challenge"))
			.exchange()
			.expectStatus()
			.isCreated()), "$.id");
		String filed = text(call(app, "set_use_case_programs",
				Map.of("use_case", id.toString(), "programs", List.of("program:claims-" + word))));
		assertThat(JsonPath.<List<String>>read(filed, "$.before")).isEmpty();
		assertThat(JsonPath.<List<String>>read(filed, "$.after")).containsExactly("Claims Challenge " + word);
		assertThat(call(app, "set_use_case_programs",
				Map.of("use_case", id.toString(), "programs", List.of(UUID.randomUUID().toString()))).isError()).isTrue();
		String none = text(call(app, "set_use_case_programs", Map.of("use_case", id.toString(), "programs", List.of())));
		assertThat(JsonPath.<List<String>>read(none, "$.after")).isEmpty();
		assertThat(program).isNotBlank();

		// Changed field by field: what is left out stays.
		String changed = text(call(app, "update_use_case", Map.of("use_case", id.toString(), "title",
				"Claims sorting " + word, "budget_to_be_determined", false, "budget_min", 10000, "budget_max", 20000)));
		assertThat(JsonPath.<String>read(changed, "$.title")).isEqualTo("Claims sorting " + word);
		String record = text(call(app, "get_record", Map.of("area", "use_cases", "id", id.toString(), "detail", true)));
		assertThat(JsonPath.<String>read(record, "$.problemStatement")).isEqualTo("Adjusters sort claim files by hand.");
		assertThat(JsonPath.<Integer>read(record, "$.budgetMax")).isEqualTo(20000);
		assertThat(JsonPath.<Boolean>read(record, "$.operatorsOnly")).isTrue();

		String published = text(call(app, "publish_use_case", Map.of("use_case", id.toString())));
		assertThat(JsonPath.<String>read(published, "$.before")).isEqualTo("private draft");
		assertThat(JsonPath.<String>read(published, "$.after")).isEqualTo("approved");
		assertThat(body(client.get()
			.uri("/api/usecase/mine/" + id)
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.exchange()
			.expectStatus()
			.isOk())).contains("Claims sorting " + word);
		client.get().uri("/api/usecase/use-cases/" + id).exchange().expectStatus().isOk();
		// Published, it is no longer GenAI Fund's private draft: its company changes it.
		assertThat(call(app, "update_use_case", Map.of("use_case", id.toString(), "title", "Again")).isError())
			.isTrue();
		assertThat(call(app, "send_back_use_case", Map.of("use_case", id.toString())).isError()).isTrue();
		String sentBack = text(call(app, "send_back_use_case",
				Map.of("use_case", id.toString(), "message", "Name the claim types.")));
		assertThat(JsonPath.<String>read(sentBack, "$.after")).isEqualTo("needs_changes");
		assertThat(JsonPath.<String>read(sentBack, "$.told")).isEqualTo("1 member of Private " + word + ", by email.");
		app.closeGracefully();

		assertThat(jdbc.sql("select action from audit_event where resource_id = :id order by occurred_at")
			.param("id", id.toString())
			.query(String.class)
			.list()).containsSubsequence("use_case.create", "use_case.update", "use_case.publish", "use_case.send_back");
	}

	private static McpSchema.Tool operatorTool(McpSyncClient app, String name) {
		return app.listTools().tools().stream().filter(tool -> tool.name().equals(name)).findFirst().orElseThrow();
	}

	private static CallToolResult decide(McpSyncClient app, Map<String, Object> arguments) {
		return app.callTool(McpSchema.CallToolRequest.builder("decide_record").arguments(arguments).build());
	}

	@Test
	void operatorsSwitchAToolOffAndTheUserServerOffAndEachChangeIsAudited() {
		String person = TestSignIn.session(client, mail, "switched-" + word + "@mcp.test");
		String token = TestAppConnection.connect(client, port, person, "mcp.read").access();

		// Only operators reach the settings.
		client.get()
			.uri("/api/mcp/admin/settings")
			.cookie(TestSignIn.SESSION_COOKIE, person)
			.exchange()
			.expectStatus()
			.isForbidden();
		client.get()
			.uri("/api/mcp/admin/settings")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.userServerEnabled")
			.isEqualTo(true)
			.jsonPath("$.userServerAddress")
			.isEqualTo(ISSUER + "/mcp")
			.jsonPath("$.tools.length()")
			.isEqualTo(31);

		switchTool("user", "fetch", false);
		try {
			McpSyncClient app = app(token);
			app.initialize();
			assertThat(app.listTools().tools()).extracting(McpSchema.Tool::name).containsExactly("search");
			app.closeGracefully();
		}
		finally {
			switchTool("user", "fetch", true);
		}

		put(operator, "/api/mcp/admin/user-server", Map.of("enabled", false));
		try {
			assertThat(initialize(token, null, null)).isEqualTo(404);
		}
		finally {
			put(operator, "/api/mcp/admin/user-server", Map.of("enabled", true));
		}
		assertThat(initialize(token, null, null)).isEqualTo(200);

		List<String> recorded = jdbc.sql("""
				select action || ' ' || resource_id from audit_event
				where action like 'mcp.tool_%' or action like 'mcp.user_server_%' order by occurred_at
				""").query(String.class).list();
		assertThat(recorded).containsSubsequence("mcp.tool_disable user.fetch", "mcp.tool_enable user.fetch",
				"mcp.user_server_disable User MCP server", "mcp.user_server_enable User MCP server");

		client.put()
			.uri("/api/mcp/admin/tools/user/no_such_tool")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("enabled", false))
			.exchange()
			.expectStatus()
			.isNotFound();
	}

	private void switchTool(String server, String tool, boolean enabled) {
		put(operator, "/api/mcp/admin/tools/" + server + "/" + tool, Map.of("enabled", enabled));
	}

	private void put(String session, String path, Object body) {
		client.put()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(body)
			.exchange()
			.expectStatus()
			.isNoContent();
	}

	private int initializeAt(String path, String token) {
		return client.post()
			.uri(path)
			.header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.header(HttpHeaders.ACCEPT, "application/json, text/event-stream")
			.contentType(MediaType.APPLICATION_JSON)
			.body("""
					{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25",
					 "capabilities":{},"clientInfo":{"name":"test","version":"1"}}}
					""")
			.exchange()
			.returnResult()
			.getStatus()
			.value();
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
		return app(token, "/mcp");
	}

	private McpSyncClient app(String token, String endpoint) {
		HttpClientStreamableHttpTransport transport = HttpClientStreamableHttpTransport
			.builder("http://localhost:" + port)
			.endpoint(endpoint)
			.httpRequestCustomizer(
					(builder, method, uri, body, context) -> builder.header("Authorization", "Bearer " + token))
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

	/** A use case an operator saved for the organization, published or kept a draft. */
	private UUID useCase(UUID organization, String title, boolean publish) {
		Map<String, Object> body = new HashMap<>();
		body.put("organizationId", organization);
		body.put("publishNow", publish);
		body.put("title", title);
		body.put("problemStatement", "Our service team checks vehicle documents by hand.");
		body.put("industry", "automotive_mobility");
		body.put("technologies", List.of("document_intelligence"));
		body.put("expectedOutcomes", "Cut hotline calls by 40%.");
		body.put("currentProcess", "Agents type dates into a spreadsheet.");
		body.put("targetUsers", "Vehicle owners and the service team.");
		body.put("requirements", List.of(Map.of("statement", "Read documents", "necessity", "required")));
		body.put("dataReadiness", "Scanned documents with labelled fields.");
		body.put("integrationRequirements", "App SDK and the document store API.");
		body.put("attachmentFileIds", List.of());
		body.put("budgetMin", 15000);
		body.put("budgetMax", 40000);
		body.put("budgetToBeDetermined", false);
		body.put("budgetMembersOnly", false);
		body.put("timelineMinWeeks", 8);
		body.put("timelineMaxWeeks", 12);
		body.put("hideOrganizationName", false);
		body.put("closesAt", Instant.now().plus(60, ChronoUnit.DAYS).toString());
		return UUID.fromString(JsonPath.read(body(client.post()
			.uri("/api/usecase/admin/use-cases")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.contentType(MediaType.APPLICATION_JSON)
			.body(body)
			.exchange()
			.expectStatus()
			.isCreated()), "$.id"));
	}

	private UUID submittedSolution(String owner, String name) {
		return submittedSolution(owner, name, true);
	}

	private UUID submittedSolution(String owner, String name, boolean listed) {
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
		request.put("offerIds", List.of());
		request.put("listed", listed);
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
