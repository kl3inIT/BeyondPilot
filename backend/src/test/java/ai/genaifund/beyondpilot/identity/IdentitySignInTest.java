package ai.genaifund.beyondpilot.identity;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Sign-in over real HTTP against PostgreSQL: the emailed code, the browser it is tied to, the session it opens, and
 * who the session is. Only the SMTP server is replaced.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=Operator@genaifund.test")
@Import({ TestcontainersConfiguration.class, IdentitySignInTest.Mail.class })
class IdentitySignInTest {

	private static final String SESSION_COOKIE = "BEYONDPILOT_SESSION";
	private static final String CSRF_HEADER = "X-BeyondPilot-CSRF";

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private IdentityService identity;

	private RestTestClient client;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
	}

	@Test
	void aCodeTypedInTheBrowserThatAskedOpensASessionOfTheAddress() {
		String browser = sessionOf(requestCode(null, "username=An.Tran@example.test&locale=vi").expectStatus()
			.isNoContent());

		String code = mail.latestCodeTo("An.Tran@example.test");
		// Email is written in English for now, whatever language the screen asked in.
		assertThat(mail.latestSubjectTo("An.Tran@example.test")).isEqualTo(code + " is your BeyondPilot sign-in code");

		String session = signIn(browser, code);

		client.get()
			.uri("/api/identity/me")
			.cookie(SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.email")
			.isEqualTo("An.Tran@example.test")
			.jsonPath("$.role")
			.isEqualTo("user")
			.jsonPath("$.displayName")
			.isEmpty()
			.jsonPath("$.id")
			.isNotEmpty();
		assertThat(session).as("signing in replaces the session of the anonymous browser").isNotEqualTo(browser);
	}

	@Test
	void aCodeWorksOnce() {
		String browser = browserWaitingFor("once@example.test");
		String code = mail.latestCodeTo("once@example.test");
		signIn(browser, code);

		assertProblem(typeCode(browser, code), 410);
	}

	@Test
	void anExpiredCodeIsRefused() {
		String browser = browserWaitingFor("late@example.test");
		jdbc.sql("update identity_sign_in_challenge set expires_at = now() - interval '1 minute' where email = ?")
			.param("late@example.test")
			.update();

		assertProblem(typeCode(browser, mail.latestCodeTo("late@example.test")), 410);
	}

	@Test
	void aCodeIsWorthNothingOutsideTheBrowserThatAskedForIt() {
		String asking = browserWaitingFor("target@example.test");
		String code = mail.latestCodeTo("target@example.test");
		String other = browserWaitingFor("someone.else@example.test");

		// No session at all, as when the code is handed to another person.
		assertProblem(typeCode(null, code), 410);
		// Another browser, waiting for its own code: the stranger's code is simply wrong there.
		assertProblem(typeCode(other, code), 401);

		// And none of that spent the code or counted against it where it belongs.
		assertThat(emailOf(signIn(asking, code))).isEqualTo("target@example.test");
	}

	@Test
	void wrongCodesStopTheCodeFromWorking() {
		String browser = browserWaitingFor("guessed@example.test");
		String code = mail.latestCodeTo("guessed@example.test");
		String wrong = code.equals("000000") ? "111111" : "000000";

		for (int attempt = 1; attempt <= 4; attempt++) {
			assertProblem(typeCode(browser, wrong), 401);
		}
		assertProblem(typeCode(browser, wrong), 429);

		assertProblem(typeCode(browser, code), 429);
	}

	@Test
	void guessesSentTogetherGetNoMoreTurnsThanGuessesSentInARow() throws Exception {
		String browser = browserWaitingFor("stormed@example.test");
		String code = mail.latestCodeTo("stormed@example.test");
		String wrong = code.equals("000000") ? "111111" : "000000";

		try (ExecutorService guesses = Executors.newVirtualThreadPerTaskExecutor()) {
			List<Callable<Object>> together = Collections.nCopies(40,
					() -> typeCode(browser, wrong).returnResult(Void.class));
			for (Future<Object> guess : guesses.invokeAll(together)) {
				guess.get();
			}
		}

		assertThat(jdbc.sql("select failed_attempts from identity_sign_in_challenge where email = 'stormed@example.test'")
			.query(Integer.class)
			.single()).as("only five of the forty were looked at").isEqualTo(5);
		assertProblem(typeCode(browser, code), 429);
	}

	@Test
	void anAddressThatKeepsGettingWrongCodesGetsNoNewCodeForADay() {
		jdbc.sql("""
				insert into identity_sign_in_challenge (id, email, code_hash, failed_attempts, expires_at, created_at)
				select gen_random_uuid(), 'besieged@example.test', 'x', 5, now() - interval '1 hour', now() - interval '2 hours'
				from generate_series(1, 3)
				""").update();

		requestCode(null, "username=besieged@example.test").expectStatus()
			.isEqualTo(429)
			.expectHeader()
			.value("Retry-After", seconds -> assertThat(Long.parseLong(seconds)).isBetween(86_000L, 86_400L));
		assertThat(mail.countTo("besieged@example.test")).isZero();
	}

	@Test
	void aNewCodeReplacesTheOneBeforeItInTheSameBrowser() {
		String browser = browserWaitingFor("again@example.test");
		String first = mail.latestCodeTo("again@example.test");
		requestCode(browser, "username=again@example.test").expectStatus().isNoContent();
		String second = mail.latestCodeTo("again@example.test");

		if (!first.equals(second)) {
			assertProblem(typeCode(browser, first), 401);
		}
		assertThat(emailOf(signIn(browser, second))).isEqualTo("again@example.test");
	}

	@Test
	void aConfiguredOperatorAddressIsAnOperatorFromItsFirstSignIn() {
		String browser = browserWaitingFor("operator@genaifund.test");
		String session = signIn(browser, mail.latestCodeTo("operator@genaifund.test"));

		client.get()
			.uri("/api/identity/me")
			.cookie(SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.role")
			.isEqualTo("operator");
	}

	@Test
	void googleAndTheCodeReachOneAccountOfAnAddress() {
		Actor byCode = identity.signInWithEmail("same@example.test");

		Actor byGoogle = identity.signInWithGoogle("google-subject-1", "Same@Example.test", true, "Same Person");
		Actor returning = identity.signInWithGoogle("google-subject-1", "moved@example.test", false, null);

		assertThat(byGoogle).isEqualTo(byCode);
		assertThat(returning).isEqualTo(byCode);
		assertThat(identity.me(byCode).displayName()).isEqualTo("Same Person");
		assertThat(jdbc.sql("select count(*) from identity_account where lower(email) = 'same@example.test'")
			.query(Integer.class)
			.single()).isEqualTo(1);
	}

	@Test
	void aFirstGoogleSignInNeedsAVerifiedAddress() {
		assertThatThrownBy(() -> identity.signInWithGoogle("google-subject-2", "unverified@example.test", false, null))
			.isInstanceOfSatisfying(IdentityException.class,
					failure -> assertThat(failure.code()).isEqualTo("IDENTITY_EMAIL_NOT_VERIFIED"));

		assertThat(jdbc.sql("select count(*) from identity_account where lower(email) = 'unverified@example.test'")
			.query(Integer.class)
			.single()).isZero();
	}

	@Test
	void aDisabledAccountCannotSignInAndItsOpenSessionStops() {
		String first = browserWaitingFor("disabled@example.test");
		String session = signIn(first, mail.latestCodeTo("disabled@example.test"));
		String second = browserWaitingFor("disabled@example.test");
		jdbc.sql("update identity_account set status = 'disabled' where email = 'disabled@example.test'").update();

		assertProblem(typeCode(second, mail.latestCodeTo("disabled@example.test")), 403);
		EntityExchangeResult<byte[]> me = client.get()
			.uri("/api/identity/me")
			.cookie(SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isForbidden()
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo("IDENTITY_ACCOUNT_DISABLED")
			.returnResult();
		assertThat(me.getResponseHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PROBLEM_JSON);
	}

	@Test
	void signingOutEndsTheSession() {
		String browser = browserWaitingFor("leaving@example.test");
		String session = signIn(browser, mail.latestCodeTo("leaving@example.test"));

		client.post()
			.uri("/logout")
			.header(CSRF_HEADER, "1")
			.cookie(SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isNoContent();

		assertProblem(client.get().uri("/api/identity/me").cookie(SESSION_COOKIE, session).exchange(), 401);
	}

	@Test
	void aLinkToTheSignOutAddressDoesNotSignOut() {
		String browser = browserWaitingFor("staying@example.test");
		String session = signIn(browser, mail.latestCodeTo("staying@example.test"));

		client.get().uri("/logout").cookie(SESSION_COOKIE, session).exchange().expectStatus().isNotFound();

		client.get().uri("/api/identity/me").cookie(SESSION_COOKIE, session).exchange().expectStatus().isOk();
	}

	@Test
	void nobodySignedInIsAnUnauthorizedProblem() {
		assertProblem(client.get().uri("/api/identity/me").exchange(), 401);
	}

	@Test
	void aStateChangingRequestWithoutTheCsrfHeaderIsRefused() {
		assertProblem(client.post()
			.uri("/ott/generate")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body("username=forged@example.test")
			.exchange(), 403);

		assertThat(mail.countTo("forged@example.test")).isZero();
	}

	@Test
	void anAddressGetsALimitedNumberOfWorkingCodes() {
		for (int request = 0; request < 3; request++) {
			requestCode(null, "username=flood@example.test").expectStatus().isNoContent();
		}

		requestCode(null, "username=flood@example.test").expectStatus()
			.isEqualTo(429)
			.expectHeader()
			.value("Retry-After", seconds -> assertThat(Long.parseLong(seconds)).isBetween(1L, 900L))
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON);
		assertThat(mail.countTo("flood@example.test")).isEqualTo(3);
		assertThat(storedCodesFor("flood@example.test")).as("a refused request stores no code").isEqualTo(3);
	}

	@Test
	void requestsThatArriveTogetherDoNotExceedTheLimit() throws Exception {
		try (ExecutorService requests = Executors.newVirtualThreadPerTaskExecutor()) {
			List<Callable<Object>> together = Collections.nCopies(8,
					() -> requestCode(null, "username=together@example.test").returnResult(Void.class));
			for (Future<Object> request : requests.invokeAll(together)) {
				request.get();
			}
		}

		assertThat(mail.countTo("together@example.test")).isBetween(1L, 3L);
	}

	@Test
	void noSpellingOfTheCodeRequestAddressGetsAroundTheChecks() {
		for (String path : List.of("/ott/generate;x=1", "/ott/generate/", "/ott//generate", "/ott/%67enerate")) {
			client.post()
				.uri(URI.create("http://localhost:" + port + path))
				.header(CSRF_HEADER, "1")
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.body("username=two@spelling.test,other@spelling.test")
				.exchange()
				.expectStatus()
				.value(status -> assertThat(status).as(path).isBetween(400, 499));
		}

		assertThat(jdbc.sql("select count(*) from identity_sign_in_challenge where email like '%spelling.test%'")
			.query(Integer.class)
			.single()).isZero();
	}

	@Test
	void aMalformedAddressIsRefused() {
		for (String value : List.of("not-an-address", "a".repeat(400) + "@refused.test",
				"two@refused.test,other@refused.test", "name%20%3Cangle@refused.test%3E", "line@refused.test%0Abcc")) {
			assertProblem(requestCode(null, "username=" + value), 400);
		}

		assertThat(jdbc.sql("select count(*) from identity_sign_in_challenge where email like '%refused.test%'")
			.query(Integer.class)
			.single()).as("nothing is stored for a refused value").isZero();
	}

	@Test
	void theCodeIsNotStoredAsSent() {
		browserWaitingFor("stored@example.test");

		assertThat(jdbc.sql("select code_hash from identity_sign_in_challenge where email = 'stored@example.test'")
			.query(String.class)
			.single()).hasSize(64).doesNotContain(mail.latestCodeTo("stored@example.test"));
	}

	private RestTestClient.ResponseSpec requestCode(String browser, String form) {
		RestTestClient.RequestBodySpec request = client.post().uri("/ott/generate").header(CSRF_HEADER, "1");
		if (browser != null) {
			request = request.cookie(SESSION_COOKIE, browser);
		}
		return request.contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).exchange();
	}

	/** Asks for a code and returns the session cookie of the browser that now waits for it. */
	private String browserWaitingFor(String email) {
		return sessionOf(requestCode(null, "username=" + email).expectStatus().isNoContent());
	}

	private RestTestClient.ResponseSpec typeCode(String browser, String code) {
		RestTestClient.RequestBodySpec request = client.post().uri("/login/ott").header(CSRF_HEADER, "1");
		if (browser != null) {
			request = request.cookie(SESSION_COOKIE, browser);
		}
		return request.contentType(MediaType.APPLICATION_FORM_URLENCODED).body("code=" + code).exchange();
	}

	/** Types the code in the browser and returns the cookie of the session that opens. */
	private String signIn(String browser, String code) {
		return sessionOf(typeCode(browser, code).expectStatus().isNoContent());
	}

	private String sessionOf(RestTestClient.ResponseSpec response) {
		List<String> cookies = response.expectBody()
			.returnResult()
			.getResponseHeaders()
			.getOrEmpty(HttpHeaders.SET_COOKIE);
		String cookie = cookies.stream()
			.filter(value -> value.startsWith(SESSION_COOKIE + "="))
			.findFirst()
			.orElseThrow(() -> new AssertionError("No session cookie in " + cookies));
		assertThat(cookie).contains("HttpOnly").contains("SameSite=Lax");
		return cookie.substring(SESSION_COOKIE.length() + 1, cookie.indexOf(';'));
	}

	private String emailOf(String session) {
		return identityEmail(client.get().uri("/api/identity/me").cookie(SESSION_COOKIE, session).exchange());
	}

	private static String identityEmail(RestTestClient.ResponseSpec response) {
		String body = new String(response.expectStatus().isOk().expectBody().returnResult().getResponseBody(), UTF_8);
		return JsonPath.read(body, "$.email");
	}

	private int storedCodesFor(String email) {
		return jdbc.sql("select count(*) from identity_sign_in_challenge where email = ?")
			.param(email)
			.query(Integer.class)
			.single();
	}

	private static void assertProblem(RestTestClient.ResponseSpec response, int status) {
		EntityExchangeResult<byte[]> result = response.expectStatus()
			.isEqualTo(status)
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.status")
			.isEqualTo(status)
			.jsonPath("$.requestId")
			.isNotEmpty()
			.returnResult();
		assertThat(result.getResponseHeaders().getFirst("X-Request-Id")).isNotBlank();
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
