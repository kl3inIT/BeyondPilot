package ai.genaifund.beyondpilot.audit;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
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
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Reading the audit log over real HTTP against PostgreSQL: who may, what an event carries, what narrows the list and
 * how it is walked a page at a time. Only the SMTP server is replaced. Each test records under a marker of its own,
 * because the table cannot be emptied.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=reader@audit.test")
@Import({ TestcontainersConfiguration.class, AuditLogTest.Mail.class })
class AuditLogTest {

	private static final String SESSION_COOKIE = "BEYONDPILOT_SESSION";

	private static final String CSRF_HEADER = "X-BeyondPilot-CSRF";

	private static final String EVENTS = "/api/audit/events";

	private static final String EXPORT = "/api/identity/admin/audit-events/export";

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private AuditTrail trail;

	@Autowired
	private TransactionTemplate transaction;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
		operator = signIn("reader@audit.test");
	}

	@Test
	void nobodyButAnOperatorReadsTheLog() {
		String user = signIn("plain@audit.test");

		client.get().uri(EVENTS).exchange().expectStatus().isUnauthorized();
		client.get()
			.uri(EVENTS)
			.cookie(SESSION_COOKIE, user)
			.exchange()
			.expectStatus()
			.isForbidden()
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON);
		read("").expectStatus().isOk();
	}

	@Test
	void anOperatorWhoseRoleIsWithdrawnStopsReadingAtOnce() {
		String second = signIn("second@audit.test");
		jdbc.sql("update identity_account set platform_role = 'operator' where email = 'second@audit.test'").update();
		client.get().uri(EVENTS).cookie(SESSION_COOKIE, second).exchange().expectStatus().isOk();

		jdbc.sql("update identity_account set platform_role = 'user' where email = 'second@audit.test'").update();

		client.get().uri(EVENTS).cookie(SESSION_COOKIE, second).exchange().expectStatus().isForbidden();
	}

	@Test
	void anEventCarriesWhoDidWhatToWhat() {
		String marker = marker();
		UUID actor = UUID.randomUUID();
		record(AuditAction.OPERATOR_GRANT, new AuditRecord.Actor(actor, "Hà Lê", "ha.le@audit.test"), marker,
				Map.of("source", "operator"));
		record(AuditAction.OPERATOR_GRANT, null, marker, Map.of("source", "configuration"));

		read("?q=" + marker).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.items.length()")
			.isEqualTo(2)
			.jsonPath("$.items[0].actor")
			.isEmpty()
			.jsonPath("$.items[0].details.source")
			.isEqualTo("configuration")
			.jsonPath("$.items[1].id")
			.isNotEmpty()
			.jsonPath("$.items[1].occurredAt")
			.isNotEmpty()
			.jsonPath("$.items[1].action")
			.isEqualTo("operator.grant")
			.jsonPath("$.items[1].actor.id")
			.isEqualTo(actor.toString())
			.jsonPath("$.items[1].actor.label")
			.isEqualTo("Hà Lê")
			.jsonPath("$.items[1].actor.email")
			.isEqualTo("ha.le@audit.test")
			.jsonPath("$.items[1].resource.type")
			.isEqualTo("account")
			.jsonPath("$.items[1].resource.label")
			.isEqualTo(marker)
			.jsonPath("$.items[1].details.source")
			.isEqualTo("operator")
			.jsonPath("$.newer")
			.isEmpty()
			.jsonPath("$.older")
			.isEmpty();
	}

	@Test
	void theLogIsNarrowedByActionTimeAndSearch() {
		String marker = marker();
		record(AuditAction.ACCOUNT_DISABLE, new AuditRecord.Actor(UUID.randomUUID(), "Mina 100%", "mina@audit.test"),
				marker, Map.of());
		record(AuditAction.ACCOUNT_ENABLE, new AuditRecord.Actor(UUID.randomUUID(), "Other", "other@audit.test"),
				marker, Map.of());

		assertThat(actions("?q=" + marker)).containsExactly("account.enable", "account.disable");
		assertThat(actions("?q=" + marker + "&action=account.disable")).containsExactly("account.disable");
		assertThat(actions("?q=" + marker + "&from=" + Instant.now().plusSeconds(60))).isEmpty();
		assertThat(actions("?q=" + marker + "&from=" + Instant.now().minusSeconds(60))).hasSize(2);
		// The search reads the actor's name and address as well as the resource's name, ignoring case.
		assertThat(actions("?action=account.disable&q=MINA@AUDIT")).contains("account.disable");
		// A percent sign and an underscore are searched for as written, not as wildcards.
		assertThat(actions("?q=mina%20100%25")).containsExactly("account.disable");
		assertThat(actions("?q=_ina%20100")).isEmpty();
	}

	@Test
	void theSearchAlsoFindsTheActionsWhoseNamesItMatches() {
		String marker = marker();
		Instant since = Instant.now().minusSeconds(1);
		record(AuditAction.ACCOUNT_DISABLE, new AuditRecord.Actor(UUID.randomUUID(), "Mina", "mina@audit.test"),
				marker, Map.of());
		// The reader searched for words such as "Downloaded": their page found the actions named so.
		record(AuditAction.ACCOUNT_EXPORT, new AuditRecord.Actor(UUID.randomUUID(), "Lan", "lan@audit.test"),
				"Accounts", Map.of("count", "3"));
		String recent = "&from=" + since;

		// An event matches by its people or resource, or by an action the search named.
		assertThat(actions("?q=" + marker + "&actions=account.export" + recent)).contains("account.export",
				"account.disable");
		assertThat(actions("?q=" + marker + recent)).containsExactly("account.disable");
		assertThat(actions("?actions=account.export&actions=audit.export" + recent)).containsOnly("account.export");
		// The action filter still narrows what the search found.
		assertThat(actions("?q=" + marker + "&actions=account.export&action=account.disable" + recent))
			.containsExactly("account.disable");
		read("?actions=no.such_action").expectStatus().isBadRequest();
	}

	@Test
	void theLogIsWalkedTowardsThePastAndBackByItsCursors() {
		String marker = marker();
		for (int i = 0; i < 120; i++) {
			record(AuditAction.ACCOUNT_DISABLE, null, marker, Map.of());
		}
		String filter = "?q=" + marker;

		String first = body(read(filter));
		String second = body(read(filter + "&before=" + JsonPath.<String>read(first, "$.older")));
		String third = body(read(filter + "&before=" + JsonPath.<String>read(second, "$.older")));
		List<String> walked = new ArrayList<>(ids(first));
		walked.addAll(ids(second));
		walked.addAll(ids(third));

		assertThat(ids(first)).hasSize(50);
		assertThat(JsonPath.<String>read(first, "$.newer")).isNull();
		assertThat(ids(third)).hasSize(20);
		assertThat(JsonPath.<String>read(third, "$.older")).isNull();
		assertThat(walked).doesNotHaveDuplicates().hasSize(120);
		// Back from the last page: the page before it, then the first, which has nothing newer.
		String back = body(read(filter + "&after=" + JsonPath.<String>read(third, "$.newer")));
		assertThat(ids(back)).isEqualTo(ids(second));
		String start = body(read(filter + "&after=" + JsonPath.<String>read(back, "$.newer")));
		assertThat(ids(start)).isEqualTo(ids(first));
		assertThat(JsonPath.<String>read(start, "$.newer")).isNull();
		assertThat(JsonPath.<String>read(start, "$.older")).isEqualTo(JsonPath.<String>read(first, "$.older"));
	}

	@Test
	void anOperatorDownloadsTheLogAsItIsNarrowedAndTheDownloadIsRecorded() {
		String marker = marker();
		record(AuditAction.OPERATOR_GRANT, new AuditRecord.Actor(UUID.randomUUID(), "Hà Lê", "ha.le@audit.test"),
				marker, Map.of("source", "operator"));
		record(AuditAction.ACCOUNT_ENABLE, null, marker, Map.of());

		download(signIn("plain@audit.test"), "?q=" + marker).expectStatus()
			.isForbidden()
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo("IDENTITY_OPERATOR_REQUIRED");
		assertThat(exportCounts()).isEmpty();

		List<List<String>> sheet = Workbooks.rows(download(operator, "?q=" + marker + "&action=operator.grant")
			.expectStatus()
			.isOk()
			.expectHeader()
			.contentType(SpreadsheetFormat.XLSX_TYPE)
			.expectHeader()
			.valueMatches("Content-Disposition", "attachment; filename=\"audit-log-\\d{4}-\\d{2}-\\d{2}\\.xlsx\".*")
			.expectBody()
			.returnResult()
			.getResponseBody());
		assertThat(sheet).hasSize(3);
		assertThat(sheet.get(0)).containsExactly("Time", "Action", "Who", "Who", "What", "What", "What", "Details",
				"Request");
		assertThat(sheet.get(1)).containsExactly("Time", "Action", "Name", "Email", "Kind", "Name", "Identifier",
				"Details", "Request");
		assertThat(sheet.get(2).subList(1, 6)).containsExactly("operator.grant", "Hà Lê", "ha.le@audit.test",
				"Account", marker);
		assertThat(sheet.get(2).get(7)).isEqualTo("source: operator");

		String csv = new String(download(operator, "?q=" + marker + "&format=csv").expectStatus()
			.isOk()
			.expectHeader()
			.contentType("text/csv;charset=UTF-8")
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8);
		assertThat(csv).startsWith("\uFEFFTime,Action,Name,Email,Kind,Name,Identifier,Details,Request\r\n");
		List<String> lines = csv.lines().toList();
		assertThat(lines).hasSize(3);
		assertThat(lines.get(1)).contains(",account.enable,The server's configuration,,Account," + marker + ",");
		assertThat(lines.get(2)).contains(",operator.grant,Hà Lê,ha.le@audit.test,Account," + marker + ",");
		assertThat(exportCounts()).containsExactly("1", "2");
	}

	@Test
	void aParameterThatIsNotValidIsAValidationProblem() {
		for (String query : List.of("?before=yesterday", "?after=1_2", "?action=account.rename", "?from=today",
				"?q=" + "x".repeat(101))) {
			read(query).expectStatus()
				.isBadRequest()
				.expectHeader()
				.contentType(MediaType.APPLICATION_PROBLEM_JSON);
		}
	}

	private static String marker() {
		return "marker-" + UUID.randomUUID();
	}

	private void record(AuditAction action, AuditRecord.Actor actor, String resourceLabel, Map<String, String> details) {
		transaction.executeWithoutResult(status -> trail.record(new AuditRecord(action, actor,
				new AuditRecord.Resource("account", UUID.randomUUID().toString(), resourceLabel), details)));
	}

	private RestTestClient.ResponseSpec read(String query) {
		return client.get()
			.uri(URI.create("http://localhost:" + port + EVENTS + query))
			.cookie(SESSION_COOKIE, operator)
			.exchange();
	}

	private RestTestClient.ResponseSpec download(String session, String query) {
		return client.post()
			.uri(URI.create("http://localhost:" + port + EXPORT + query))
			.header(CSRF_HEADER, "1")
			.cookie(SESSION_COOKIE, session)
			.exchange();
	}

	private List<String> exportCounts() {
		return jdbc.sql("select details ->> 'count' from audit_event where action = 'audit.export' order by occurred_at")
			.query(String.class)
			.list();
	}

	private static String body(RestTestClient.ResponseSpec response) {
		return new String(response.expectStatus().isOk().expectBody().returnResult().getResponseBody(), UTF_8);
	}

	private List<String> actions(String query) {
		return JsonPath.read(body(read(query)), "$.items[*].action");
	}

	private static List<String> ids(String body) {
		return JsonPath.read(body, "$.items[*].id");
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

	/**
	 * The test mailbox, imported through a class of this test's own so that the test keeps a Spring context, and with
	 * it a database, of its own.
	 */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

}
