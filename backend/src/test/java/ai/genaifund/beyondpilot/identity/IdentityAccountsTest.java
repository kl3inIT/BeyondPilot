package ai.genaifund.beyondpilot.identity;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import ai.genaifund.beyondpilot.shared.Workbooks;
import com.jayway.jsonpath.JsonPath;
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
 * What operators do with accounts, over real HTTP against PostgreSQL: who may, what the list returns, what each command
 * changes at once, what it refuses, and what the audit trail keeps of it. Only the SMTP server is replaced.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=boss@accounts.test,second@accounts.test")
@Import({ TestcontainersConfiguration.class, IdentityAccountsTest.Mail.class })
class IdentityAccountsTest {

	private static final String SESSION_COOKIE = "BEYONDPILOT_SESSION";

	private static final String CSRF_HEADER = "X-BeyondPilot-CSRF";

	private static final String ACCOUNTS = "/api/identity/accounts";

	private static final List<String> COMMANDS = List.of("disable", "enable", "grant-operator", "withdraw-operator");

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
		operator = signIn("boss@accounts.test");
	}

	@Test
	void nobodyButAnOperatorReadsOrChangesAccounts() {
		String user = signIn("plain@accounts.test");
		UUID target = idOf("plain@accounts.test");

		client.get().uri(ACCOUNTS).exchange().expectStatus().isUnauthorized();
		assertProblem(client.get().uri(ACCOUNTS).cookie(SESSION_COOKIE, user).exchange(), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		for (String command : COMMANDS) {
			command(null, target, command).expectStatus().isUnauthorized();
			assertProblem(command(user, target, command), 403, "IDENTITY_OPERATOR_REQUIRED");
		}
		assertThat(eventsOf(target)).isEmpty();
	}

	@Test
	void theListIsLatestSignInFirstAndCarriesWhatTheScreenShows() {
		signIn("Earlier@accounts.test");
		signIn("later@accounts.test");
		jdbc.sql("update identity_account set display_name = 'Later Person' where email = 'later@accounts.test'")
			.update();
		operator = signIn("boss@accounts.test");

		list("").expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.page")
			.isEqualTo(1)
			.jsonPath("$.pageSize")
			.isEqualTo(25)
			.jsonPath("$.items[0].email")
			.isEqualTo("boss@accounts.test")
			.jsonPath("$.items[0].role")
			.isEqualTo("operator")
			.jsonPath("$.items[0].status")
			.isEqualTo("active")
			.jsonPath("$.items[0].configuredOperator")
			.isEqualTo(true)
			.jsonPath("$.items[0].lastSignInAt")
			.isNotEmpty()
			.jsonPath("$.items[0].createdAt")
			.isNotEmpty()
			.jsonPath("$.items[1].email")
			.isEqualTo("later@accounts.test")
			.jsonPath("$.items[1].displayName")
			.isEqualTo("Later Person")
			.jsonPath("$.items[1].role")
			.isEqualTo("user")
			.jsonPath("$.items[1].configuredOperator")
			.isEqualTo(false)
			.jsonPath("$.items[2].email")
			.isEqualTo("Earlier@accounts.test")
			.jsonPath("$.items[2].displayName")
			.isEmpty();
	}

	@Test
	void theListIsNarrowedBySearchStatusAndRole() {
		insert("Mina.Search@find.test", "Quiet One", "active", "user");
		insert("other@find.test", "Mina Named", "disabled", "user");
		insert("staff@find.test", null, "active", "operator");
		insert("100%@find.test", null, "active", "user");

		assertThat(emails("?q=MINA")).containsExactlyInAnyOrder("Mina.Search@find.test", "other@find.test");
		assertThat(emails("?q=find.test&status=disabled")).containsExactly("other@find.test");
		assertThat(emails("?q=find.test&role=operator")).containsExactly("staff@find.test");
		assertThat(emails("?q=find.test&status=active&role=user")).containsExactlyInAnyOrder("Mina.Search@find.test",
				"100%@find.test");
		// A percent sign and an underscore are searched for as written, not as wildcards.
		assertThat(emails("?q=100%25@find")).containsExactly("100%@find.test");
		assertThat(emails("?q=_ina")).isEmpty();
	}

	@Test
	void anOperatorDownloadsTheAccountsAsTheListNarrowsThemAndTheDownloadIsRecorded() {
		insert("zed@exported-accounts.test", "Zed Exported", "active", "user");
		insert("amy@exported-accounts.test", "Amy Exported", "active", "user");
		insert("gone@exported-accounts.test", "Gone Exported", "disabled", "user");
		String export = ACCOUNTS + "/export?q=exported-accounts&status=active&sort=name";
		String user = signIn("plain@exported-accounts.test");

		assertProblem(exported(user, export), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertThat(exportCounts()).isEmpty();

		List<List<String>> sheet = Workbooks.rows(exported(operator, export).expectStatus()
			.isOk()
			.expectHeader()
			.contentType(SpreadsheetFormat.XLSX_TYPE)
			.expectHeader()
			.valueMatches("Content-Disposition", "attachment; filename=\"accounts-\\d{4}-\\d{2}-\\d{2}\\.xlsx\".*")
			.expectBody()
			.returnResult()
			.getResponseBody());
		// The person who asked signed in with an address of the domain too, and is a user.
		assertThat(sheet).hasSize(4);
		assertThat(sheet.get(0)).startsWith("Name", "Email", "Role", "Status", "Last sign-in");
		assertThat(sheet.get(1)).startsWith("Amy Exported", "amy@exported-accounts.test", "User", "Active");
		assertThat(sheet.get(3)).startsWith("Zed Exported");

		String csv = new String(exported(operator, export + "&format=csv").expectStatus()
			.isOk()
			.expectHeader()
			.contentType("text/csv;charset=UTF-8")
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8);
		assertThat(csv).startsWith("\uFEFFName,Email,Role,Status,Last sign-in,");
		assertThat(csv.lines().toList()).hasSize(4).element(1).asString().startsWith("Amy Exported,amy@exported-accounts.test,");
		assertThat(exportCounts()).containsExactly("3", "3");
	}

	@Test
	void theListSortsByTheKeyItIsGivenAndRefusesAnUnknownOne() {
		insert("b@sorted.test", "Bea", "active", "user");
		insert("c@sorted.test", null, "active", "user");
		insert("a@sorted.test", "Zed", "active", "user");
		jdbc.sql("""
				update identity_account set
				  last_login_at = case email when 'b@sorted.test' then now() - interval '1 day'
				                             when 'a@sorted.test' then now() - interval '2 days' end,
				  created_at = case email when 'b@sorted.test' then now() - interval '3 days'
				                          when 'c@sorted.test' then now() - interval '2 days'
				                          else now() - interval '1 day' end
				where email like '%@sorted.test'
				""").update();

		// The name, or the address when there is none.
		assertThat(emails("?q=@sorted.test&sort=name")).containsExactly("b@sorted.test", "c@sorted.test",
				"a@sorted.test");
		assertThat(emails("?q=@sorted.test&sort=-name")).containsExactly("a@sorted.test", "c@sorted.test",
				"b@sorted.test");
		// An account that never signed in comes last either way.
		assertThat(emails("?q=@sorted.test&sort=lastSignIn")).containsExactly("a@sorted.test", "b@sorted.test",
				"c@sorted.test");
		assertThat(emails("?q=@sorted.test&sort=-lastSignIn")).containsExactly("b@sorted.test", "a@sorted.test",
				"c@sorted.test");
		assertThat(emails("?q=@sorted.test&sort=-created")).containsExactly("a@sorted.test", "c@sorted.test",
				"b@sorted.test");
		assertThat(emails("?q=@sorted.test")).isEqualTo(emails("?q=@sorted.test&sort=-lastSignIn"));
		assertThat(JsonPath.<List<String>>read(new String(list("?sort=email").expectStatus()
			.isBadRequest()
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8), "$.errors[*].pointer")).containsExactly("#/sort");
	}

	@Test
	void theListIsPagedAndAPagePastTheEndIsEmptyWithTheTrueTotal() {
		for (int i = 0; i < 30; i++) {
			insert("person" + i + "@paged.test", null, "active", "user");
		}

		list("?q=@paged.test").expectBody().jsonPath("$.total").isEqualTo(30).jsonPath("$.items.length()").isEqualTo(25);
		list("?q=@paged.test&page=2").expectBody()
			.jsonPath("$.page")
			.isEqualTo(2)
			.jsonPath("$.items.length()")
			.isEqualTo(5);
		list("?q=@paged.test&page=3").expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.total")
			.isEqualTo(30)
			.jsonPath("$.items.length()")
			.isEqualTo(0);
	}

	@Test
	void aParameterOutOfBoundsIsAValidationProblemThatPointsAtIt() {
		String body = new String(list("?status=gone&role=admin&page=0&q=" + "x".repeat(101)).expectStatus()
			.isBadRequest()
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8);

		assertThat(JsonPath.<String>read(body, "$.code")).isEqualTo("REQUEST_INVALID");
		assertThat(JsonPath.<List<String>>read(body, "$.errors[*].pointer")).containsExactlyInAnyOrder("#/status",
				"#/role", "#/page", "#/q");
	}

	@Test
	void disablingStopsAnAccountAtOnceAndEnablingBringsItBack() {
		String user = signIn("stopped@accounts.test");
		UUID target = idOf("stopped@accounts.test");

		command(operator, target, "disable").expectStatus().isNoContent();

		assertProblem(client.get().uri("/api/identity/me").cookie(SESSION_COOKIE, user).exchange(), 403,
				"IDENTITY_ACCOUNT_DISABLED");
		assertThat(emails("?q=stopped@accounts.test&status=disabled")).containsExactly("stopped@accounts.test");

		command(operator, target, "disable").expectStatus().isNoContent();
		command(operator, target, "enable").expectStatus().isNoContent();
		command(operator, target, "enable").expectStatus().isNoContent();

		client.get().uri("/api/identity/me").cookie(SESSION_COOKIE, user).exchange().expectStatus().isOk();
		// A repeated command changes nothing and records nothing.
		assertThat(eventsOf(target)).extracting(event -> event.get("action"))
			.containsExactly("account.disable", "account.enable");
		assertThat(eventsOf(target).getFirst()).containsEntry("actor_id", idOf("boss@accounts.test"))
			.containsEntry("actor_label", "boss@accounts.test")
			.containsEntry("actor_email", "boss@accounts.test")
			.containsEntry("resource_label", "stopped@accounts.test");
		assertThat(eventsOf(target).getFirst().get("request_id")).isNotNull();
	}

	@Test
	void theOperatorRoleIsGrantedAndWithdrawnAtOnce() {
		String user = signIn("promoted@accounts.test");
		UUID target = idOf("promoted@accounts.test");

		command(operator, target, "grant-operator").expectStatus().isNoContent();
		command(operator, target, "grant-operator").expectStatus().isNoContent();

		client.get().uri(ACCOUNTS).cookie(SESSION_COOKIE, user).exchange().expectStatus().isOk();

		command(operator, target, "withdraw-operator").expectStatus().isNoContent();

		assertProblem(client.get().uri(ACCOUNTS).cookie(SESSION_COOKIE, user).exchange(), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		assertThat(eventsOf(target)).extracting(event -> event.get("action"), event -> event.get("source"))
			.containsExactly(tuple("operator.grant", "operator"),
					tuple("operator.withdraw", null));
	}

	@Test
	void anOperatorCannotDisableOrDemoteThemselves() {
		UUID self = idOf("boss@accounts.test");
		int before = eventsOf(self).size();

		assertProblem(command(operator, self, "disable"), 409, "IDENTITY_OWN_ACCOUNT");
		assertProblem(command(operator, self, "withdraw-operator"), 409, "IDENTITY_OWN_ACCOUNT");

		list("").expectStatus().isOk();
		assertThat(eventsOf(self)).hasSize(before);
	}

	@Test
	void anOperatorNamedInTheConfigurationKeepsTheRole() {
		signIn("second@accounts.test");
		UUID configured = idOf("second@accounts.test");

		assertProblem(command(operator, configured, "withdraw-operator"), 409, "IDENTITY_OPERATOR_CONFIGURED");

		assertThat(emails("?q=second@accounts.test&role=operator")).containsExactly("second@accounts.test");
	}

	@Test
	void aConfiguredAddressBecomingAnOperatorIsRecordedWithoutAnActor() {
		assertThat(eventsOf(idOf("boss@accounts.test")).getFirst()).containsEntry("action", "operator.grant")
			.containsEntry("source", "configuration")
			.containsEntry("actor_id", null);
	}

	@Test
	void anAccountThatDoesNotExistIsNotFound() {
		for (String command : COMMANDS) {
			assertProblem(command(operator, UUID.randomUUID(), command), 404, "IDENTITY_ACCOUNT_NOT_FOUND");
		}
	}

	/** The query is sent as written, so a test encodes what it means to send. */
	private RestTestClient.ResponseSpec list(String query) {
		return client.get()
			.uri(URI.create("http://localhost:" + port + ACCOUNTS + query))
			.cookie(SESSION_COOKIE, operator)
			.exchange();
	}

	private List<String> emails(String query) {
		String body = new String(list(query).expectStatus().isOk().expectBody().returnResult().getResponseBody(),
				UTF_8);
		return JsonPath.read(body, "$.items[*].email");
	}

	private RestTestClient.ResponseSpec exported(String session, String uri) {
		return client.post().uri(uri).header(CSRF_HEADER, "1").cookie(SESSION_COOKIE, session).exchange();
	}

	private List<String> exportCounts() {
		return jdbc.sql("select details ->> 'count' from audit_event where action = 'account.export' order by occurred_at")
			.query(String.class)
			.list();
	}

	private RestTestClient.ResponseSpec command(String session, UUID account, String command) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri(ACCOUNTS + "/" + account + "/" + command)
			.header(CSRF_HEADER, "1");
		if (session != null) {
			request = request.cookie(SESSION_COOKIE, session);
		}
		return request.exchange();
	}

	/** Asks for a code, reads it from the email and types it; returns the cookie of the session that opens. */
	private String signIn(String email) {
		String browser = sessionOf(client.post()
			.uri("/ott/generate")
			.header(CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body("username=" + email)
			.exchange()
			.expectStatus()
			.isNoContent());
		return sessionOf(client.post()
			.uri("/login/ott")
			.header(CSRF_HEADER, "1")
			.cookie(SESSION_COOKIE, browser)
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body("code=" + mail.latestCodeTo(email))
			.exchange()
			.expectStatus()
			.isNoContent());
	}

	private static String sessionOf(RestTestClient.ResponseSpec response) {
		String cookie = response.expectBody()
			.returnResult()
			.getResponseHeaders()
			.getOrEmpty(HttpHeaders.SET_COOKIE)
			.stream()
			.filter(value -> value.startsWith(SESSION_COOKIE + "="))
			.findFirst()
			.orElseThrow(() -> new AssertionError("No session cookie"));
		return cookie.substring(SESSION_COOKIE.length() + 1, cookie.indexOf(';'));
	}

	private void insert(String email, String name, String status, String role) {
		jdbc.sql("""
				insert into identity_account (id, email, display_name, status, platform_role)
				values (?, ?, ?, ?, ?) on conflict (lower(email)) do nothing
				""").params(UUID.randomUUID(), email, name, status, role).update();
	}

	private UUID idOf(String email) {
		return jdbc.sql("select id from identity_account where lower(email) = lower(?)")
			.param(email)
			.query(UUID.class)
			.single();
	}

	private List<Map<String, Object>> eventsOf(UUID account) {
		return jdbc.sql("""
				select action, actor_id, actor_label, actor_email, resource_label, request_id,
				       details ->> 'source' as source
				from audit_event where resource_type = 'account' and resource_id = ? order by occurred_at, id
				""").param(account.toString()).query().listOfRows();
	}

	private static void assertProblem(RestTestClient.ResponseSpec response, int status, String code) {
		response.expectStatus()
			.isEqualTo(status)
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo(code)
			.jsonPath("$.requestId")
			.isNotEmpty();
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
