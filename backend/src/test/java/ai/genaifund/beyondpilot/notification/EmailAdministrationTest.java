package ai.genaifund.beyondpilot.notification;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Admin › Email over real HTTP against PostgreSQL, with a real SMTP server for the mail: the settings and their
 * secrets, the wording of each kind, the log with sending again, and suppressed addresses. Only operators reach any of
 * it, and every change lands in the audit log.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@email.test")
@Import({ TestcontainersConfiguration.class, EmailAdministrationTest.Mail.class })
class EmailAdministrationTest {

	private static final String API = "/api/notification/admin";

	/** A key made for this run, so that no key is written in the repository. */
	@DynamicPropertySource
	static void encryptionKey(DynamicPropertyRegistry registry) {
		byte[] key = new byte[32];
		new SecureRandom().nextBytes(key);
		registry.add("beyondpilot.notification.encryption-key", () -> Base64.getEncoder().encodeToString(key));
	}

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
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
		mail.pointSettingsHere();
		operator = TestSignIn.session(client, mail, "operator@email.test");
	}

	@Test
	void onlyOperatorsReachTheEmailAdministration() {
		String person = TestSignIn.session(client, mail, "person@email.test");

		for (String path : List.of("/settings", "/templates", "/messages", "/suppressions")) {
			assertProblem(get(person, API + path), 403, "IDENTITY_OPERATOR_REQUIRED");
		}
		client.get().uri(API + "/settings").exchange().expectStatus().isUnauthorized();
	}

	@Test
	void aSecretIsStoredSealedNeverReturnedAndNotReusedForAnotherServer() {
		String read = body(get(operator, API + "/settings").expectStatus().isOk());
		assertThat(JsonPath.<String>read(read, "$.provider")).isEqualTo("smtp");
		assertThat(JsonPath.<Boolean>read(read, "$.ready")).isTrue();
		assertThat(JsonPath.<Boolean>read(read, "$.encryptionReady")).isTrue();

		String saved = body(put(operator, API + "/settings",
				settings("ses", version(read), smtp(null), ses("ap-southeast-1", "AKIATESTKEY", "a-secret"), null))
			.expectStatus()
			.isOk());

		assertThat(JsonPath.<Boolean>read(saved, "$.ses.secretAccessKeySet")).isTrue();
		assertThat(saved).doesNotContain("a-secret");
		byte[] stored = jdbc.sql("select ses_secret_access_key from email_settings").query(byte[].class).single();
		assertThat(new String(stored, UTF_8)).doesNotContain("a-secret");
		assertThat(JsonPath.<String>read(saved, "$.updatedBy")).isEqualTo("operator@email.test");
		// Left empty, the secret is kept for the same account; for another key it must be entered again.
		put(operator, API + "/settings", settings("ses", version(saved), smtp(null), ses("ap-southeast-1", "AKIATESTKEY", null), null))
			.expectStatus()
			.isOk();
		String kept = body(get(operator, API + "/settings").expectStatus().isOk());
		assertProblem(put(operator, API + "/settings",
				settings("ses", version(kept), smtp(null), ses("ap-southeast-1", "AKIAOTHERKEY", null), null)), 400,
				"NOTIFICATION_SETTINGS_INCOMPLETE");
		assertProblem(put(operator, API + "/settings",
				settings("ses", version(kept) - 1, smtp(null), ses("ap-southeast-1", "AKIATESTKEY", null), null)), 409,
				"NOTIFICATION_SETTINGS_CHANGED");
		assertThat(events("email_settings")).contains("email.settings_update");
	}

	@Test
	void aTestGoesToTheOperatorThroughTheSettingsOfTheForm() {
		String read = body(get(operator, API + "/settings").expectStatus().isOk());

		String tested = body(post(operator, API + "/settings/test",
				settings("smtp", version(read), smtp(mail.smtpPort()), ses(null, null, null), null))
			.expectStatus()
			.isOk());

		assertThat(JsonPath.<Boolean>read(tested, "$.sent")).isTrue();
		assertThat(JsonPath.<String>read(tested, "$.recipient")).isEqualTo("operator@email.test");
		assertThat(mail.latestSubjectTo("operator@email.test")).isEqualTo("BeyondPilot email works");
		// A server that does not answer is reported, not thrown.
		String refused = body(post(operator, API + "/settings/test",
				settings("smtp", version(read), smtp(1), ses(null, null, null), null))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Boolean>read(refused, "$.sent")).isFalse();
		assertThat(JsonPath.<String>read(refused, "$.failure")).isEqualTo("unavailable");
	}

	@Test
	void anOperatorRewordsAKindChecksItAndPutsItBack() {
		String list = body(get(operator, API + "/templates").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].kind")).contains("sign_in_code", "talent_enquiry")
			.doesNotContain("application_outcome");

		String preview = body(post(operator, API + "/templates/sign_in_code/preview",
				Map.of("subject", "Your code", "body", "Use **{{codee}}**")).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(preview, "$.problems[*].type")).containsExactlyInAnyOrder(
				"unknown_variable", "missing_variable", "missing_variable");
		assertProblem(put(operator, API + "/templates/sign_in_code",
				template("Your code", "Use **{{codee}}**", null)), 400, "NOTIFICATION_TEMPLATE_INVALID");

		String saved = body(put(operator, API + "/templates/sign_in_code",
				template("{{code}} opens BeyondPilot", "# Your code\n\n**{{code}}**\n\nIt works for {{minutes}} minutes.",
						null))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Boolean>read(saved, "$.edited")).isTrue();
		assertProblem(put(operator, API + "/templates/sign_in_code", template("{{code}} again", "**{{code}}** {{minutes}}",
				null)), 409, "NOTIFICATION_TEMPLATE_CHANGED");

		TestSignIn.session(client, mail, "reworded@email.test");
		String code = mail.latestCodeTo("reworded@email.test");
		assertThat(mail.latestSubjectTo("reworded@email.test")).isEqualTo(code + " opens BeyondPilot");

		String reset = body(delete(operator, API + "/templates/sign_in_code").expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(reset, "$.edited")).isFalse();
		assertThat(events("email_template")).containsExactly("email.template_update", "email.template_reset");
	}

	@Test
	void theLogShowsWhatWasSentKeepsCodesMaskedAndSendsAgain() {
		TestSignIn.session(client, mail, "logged@email.test");
		String code = mail.latestCodeTo("logged@email.test");

		String list = body(get(operator, API + "/messages?q=logged@email").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].status")).containsExactly("sent");
		assertThat(JsonPath.<Integer>read(list, "$.counts.sent")).isPositive();
		String id = JsonPath.read(list, "$.items[0].id");
		String message = body(get(operator, API + "/messages/" + id).expectStatus().isOk());
		assertThat(message).doesNotContain(code);
		assertThat(JsonPath.<Boolean>read(message, "$.resendable")).isFalse();
		assertProblem(post(operator, API + "/messages/" + id + "/resend", null), 409,
				"NOTIFICATION_MESSAGE_NOT_RESENDABLE");
		assertProblem(get(operator, API + "/messages/" + UUID.randomUUID()), 404, "NOTIFICATION_MESSAGE_NOT_FOUND");
	}

	@Test
	void aSuppressedAddressIsSkippedUntilAnOperatorRemovesIt() {
		String added = body(post(operator, API + "/suppressions", Map.of("address", "Gone@Email.test"))
			.expectStatus()
			.isCreated());
		assertThat(JsonPath.<String>read(added, "$.address")).isEqualTo("gone@email.test");
		assertProblem(post(operator, API + "/suppressions", Map.of("address", "gone@email.test")), 409,
				"NOTIFICATION_SUPPRESSION_EXISTS");

		client.post()
			.uri("/ott/generate")
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body("username=Gone@Email.test")
			.exchange()
			.expectStatus()
			.isEqualTo(503);
		assertThat(mail.countTo("Gone@Email.test")).isZero();
		String skipped = body(get(operator, API + "/messages?status=skipped&q=gone@").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(skipped, "$.items[*].lastError")).containsExactly("suppressed");

		String list = body(get(operator, API + "/suppressions?reason=manual").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].address")).contains("gone@email.test");
		delete(operator, API + "/suppressions/gone@email.test").expectStatus().isNoContent();
		assertProblem(delete(operator, API + "/suppressions/gone@email.test"), 404, "NOTIFICATION_SUPPRESSION_NOT_FOUND");
		assertThat(events("email_address")).contains("email.suppression_add", "email.suppression_remove");

		TestSignIn.session(client, mail, "Gone@Email.test");
	}

	private static Map<String, Object> settings(String provider, long version, Map<String, Object> smtp,
			Map<String, Object> ses, String resendKey) {
		Map<String, Object> body = new HashMap<>();
		body.put("provider", provider);
		body.put("fromName", "BeyondPilot");
		body.put("fromAddress", "no-reply@beyondpilot.test");
		body.put("smtp", smtp);
		body.put("ses", ses);
		Map<String, Object> resend = new HashMap<>();
		resend.put("apiKey", resendKey);
		body.put("resend", resend);
		body.put("version", version);
		return body;
	}

	private static Map<String, Object> smtp(Integer port) {
		Map<String, Object> smtp = new HashMap<>();
		smtp.put("host", port == null ? null : "127.0.0.1");
		smtp.put("port", port);
		smtp.put("security", "none");
		return smtp;
	}

	private static Map<String, Object> ses(String region, String keyId, String secret) {
		Map<String, Object> ses = new HashMap<>();
		ses.put("region", region);
		ses.put("accessKeyId", keyId);
		ses.put("secretAccessKey", secret);
		return ses;
	}

	private static Map<String, Object> template(String subject, String body, Long version) {
		Map<String, Object> template = new HashMap<>();
		template.put("subject", subject);
		template.put("body", body);
		template.put("version", version);
		return template;
	}

	private static long version(String settings) {
		return JsonPath.<Number>read(settings, "$.version").longValue();
	}

	private List<String> events(String resourceType) {
		return jdbc.sql("select action from audit_event where resource_type = ? order by occurred_at, id")
			.param(resourceType)
			.query(String.class)
			.list();
	}

	private RestTestClient.ResponseSpec get(String session, String path) {
		return client.get().uri(path).cookie(TestSignIn.SESSION_COOKIE, session).exchange();
	}

	private RestTestClient.ResponseSpec delete(String session, String path) {
		return client.delete()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange();
	}

	private RestTestClient.ResponseSpec post(String session, String path, Object body) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session);
		return body == null ? request.exchange() : request.contentType(MediaType.APPLICATION_JSON).body(body).exchange();
	}

	private RestTestClient.ResponseSpec put(String session, String path, Object body) {
		return client.put()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(body)
			.exchange();
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
