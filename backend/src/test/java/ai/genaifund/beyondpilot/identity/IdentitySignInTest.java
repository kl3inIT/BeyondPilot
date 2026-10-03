package ai.genaifund.beyondpilot.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Sign-in over real HTTP against PostgreSQL: the emailed link, the session cookie it opens, and who the session is.
 * Only the SMTP server is replaced.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "beyondpilot.identity.operator-emails=Operator@genaifund.test",
				"beyondpilot.identity.public-url=https://beyondpilot.test" })
@Import({ TestcontainersConfiguration.class, IdentitySignInTest.Mail.class })
class IdentitySignInTest {

	private static final String SESSION_COOKIE = "BEYONDPILOT_SESSION";
	private static final String CSRF_HEADER = "X-BeyondPilot-CSRF";

	@LocalServerPort
	private int port;

	@Autowired
	private RecordingMailSender mail;

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
	void anEmailedLinkOpensASessionOfTheAddress() {
		requestLink("username=An.Tran@example.test&locale=vi&returnTo=/programs/insurance").expectStatus()
			.isNoContent();

		String link = mail.latestLinkTo("An.Tran@example.test");
		assertThat(link).startsWith("https://beyondpilot.test/vi/sign-in/link?token=")
			.contains("returnTo=/programs/insurance");
		assertThat(mail.latestSubjectTo("An.Tran@example.test")).isEqualTo("Link đăng nhập BeyondPilot của bạn");

		String session = redeem(RecordingMailSender.query(link).get("token"));

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
	}

	@Test
	void aLinkWorksOnce() {
		String token = tokenFor("once@example.test");
		redeem(token);

		assertProblem(redeemExchange(token), 401);
	}

	@Test
	void anExpiredLinkIsRefused() {
		String token = tokenFor("late@example.test");
		jdbc.sql("update one_time_tokens set expires_at = expires_at - interval '16 minutes' where token_value = ?")
			.param(token)
			.update();

		assertProblem(redeemExchange(token), 401);
	}

	@Test
	void anExternalSiteCannotBeTheReturnDestination() {
		requestLink("username=return@example.test&returnTo=//evil.example/steal").expectStatus().isNoContent();

		assertThat(mail.latestLinkTo("return@example.test")).doesNotContain("returnTo").doesNotContain("evil");
	}

	@Test
	void aConfiguredOperatorAddressIsAnOperatorFromItsFirstSignIn() {
		String session = redeem(tokenFor("operator@genaifund.test"));

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
	void googleAndTheLinkReachOneAccountOfAnAddress() {
		Actor byLink = identity.signInWithEmail("same@example.test");

		Actor byGoogle = identity.signInWithGoogle("google-subject-1", "Same@Example.test", true, "Same Person");
		Actor returning = identity.signInWithGoogle("google-subject-1", "moved@example.test", false, null);

		assertThat(byGoogle).isEqualTo(byLink);
		assertThat(returning).isEqualTo(byLink);
		assertThat(identity.me(byLink).displayName()).isEqualTo("Same Person");
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
		String session = redeem(tokenFor("disabled@example.test"));
		String nextToken = tokenFor("disabled@example.test");
		jdbc.sql("update identity_account set status = 'disabled' where email = 'disabled@example.test'").update();

		assertProblem(redeemExchange(nextToken), 401);
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
		String session = redeem(tokenFor("leaving@example.test"));

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
		String session = redeem(tokenFor("staying@example.test"));

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
	void anAddressGetsALimitedNumberOfWorkingLinks() {
		for (int request = 0; request < 3; request++) {
			requestLink("username=flood@example.test").expectStatus().isNoContent();
		}

		requestLink("username=flood@example.test").expectStatus()
			.isEqualTo(429)
			.expectHeader()
			.valueEquals("Retry-After", "900")
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON);
		assertThat(mail.countTo("flood@example.test")).isEqualTo(3);
	}

	@Test
	void aMalformedAddressIsRefused() {
		assertProblem(requestLink("username=not-an-address"), 400);
		assertProblem(requestLink("username=" + "a".repeat(400) + "@example.test"), 400);
	}

	private RestTestClient.ResponseSpec requestLink(String form) {
		return client.post()
			.uri("/ott/generate")
			.header(CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body(form)
			.exchange();
	}

	private String tokenFor(String email) {
		requestLink("username=" + email).expectStatus().isNoContent();
		return RecordingMailSender.query(mail.latestLinkTo(email)).get("token");
	}

	private RestTestClient.ResponseSpec redeemExchange(String token) {
		return client.post()
			.uri("/login/ott")
			.header(CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body("token=" + token)
			.exchange();
	}

	/** Redeems the token and returns the value of the session cookie it opens. */
	private String redeem(String token) {
		EntityExchangeResult<byte[]> result = redeemExchange(token).expectStatus()
			.isNoContent()
			.expectBody()
			.returnResult();
		List<String> cookies = result.getResponseHeaders().getOrEmpty(HttpHeaders.SET_COOKIE);
		String cookie = cookies.stream()
			.filter(value -> value.startsWith(SESSION_COOKIE + "="))
			.findFirst()
			.orElseThrow(() -> new AssertionError("No session cookie in " + cookies));
		assertThat(cookie).contains("HttpOnly").contains("SameSite=Lax");
		return cookie.substring(SESSION_COOKIE.length() + 1, cookie.indexOf(';'));
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

	@TestConfiguration(proxyBeanMethods = false)
	static class Mail {

		@Bean
		RecordingMailSender recordingMailSender() {
			return new RecordingMailSender();
		}
	}
}
