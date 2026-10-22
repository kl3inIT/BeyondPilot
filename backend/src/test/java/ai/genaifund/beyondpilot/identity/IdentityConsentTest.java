package ai.genaifund.beyondpilot.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * What a person agrees to about their personal data, over real HTTP against PostgreSQL: what the first answer records,
 * what a later change records, what the account says while the platform purpose is missing, and that the record cannot
 * be rewritten.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import({ TestcontainersConfiguration.class, IdentityConsentTest.Mail.class })
class IdentityConsentTest {

	private static final String CONSENT = "/api/identity/consent";

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
	}

	@Test
	void aNewAccountHasAnsweredNothingAndMustAgree() {
		String session = TestSignIn.sessionWithoutConsent(client, mail, "new@consent.test");

		client.get()
			.uri("/api/identity/me")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.consentNeeded")
			.isEqualTo(true);
		client.get()
			.uri(CONSENT)
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.version")
			.isEqualTo(1)
			.jsonPath("$.locale")
			.isEqualTo("en")
			.jsonPath("$.needed")
			.isEqualTo(true)
			.jsonPath("$.text")
			.value(text -> assertThat((String) text).contains("GenAI Technology Development Pte. Ltd."))
			.jsonPath("$.purposes[*].key")
			.isEqualTo(List.of("platform", "partners", "ai", "updates"))
			.jsonPath("$.purposes[*].requiredFor")
			.isEqualTo(List.of("platform", "apply", "none", "none"))
			.jsonPath("$.purposes[0].granted")
			.isEmpty();
	}

	@Test
	void theFirstAnswerRecordsEveryPurposeARefusalIncluded() {
		String session = TestSignIn.sessionWithoutConsent(client, mail, "chooser@consent.test");

		put(session, Map.of("platform", true, "partners", false, "ai", true, "updates", false, "source", "choose"))
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.needed")
			.isEqualTo(false)
			.jsonPath("$.purposes[*].granted")
			.isEqualTo(List.of(true, false, true, false))
			.jsonPath("$.purposes[0].answeredAt")
			.isNotEmpty();

		assertThat(records("chooser@consent.test")).extracting("purpose", "granted", "version", "source")
			.containsExactlyInAnyOrder(tuple("platform", true, 1, "choose"), tuple("partners", false, 1, "choose"),
					tuple("ai", true, 1, "choose"), tuple("updates", false, 1, "choose"));
		assertThat(records("chooser@consent.test")).allSatisfy(row -> assertThat(row.requestId()).isNotNull());
		client.get()
			.uri("/api/identity/me")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectBody()
			.jsonPath("$.consentNeeded")
			.isEqualTo(false);
	}

	@Test
	void aLaterChangeRecordsOnlyWhatChanged() {
		String session = TestSignIn.sessionWithoutConsent(client, mail, "changer@consent.test");
		put(session, Map.of("platform", true, "partners", true, "ai", true, "updates", true, "source", "accept_all"))
			.expectStatus()
			.isOk();

		put(session, Map.of("platform", true, "partners", true, "ai", false, "updates", true, "source", "settings"))
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.purposes[2].granted")
			.isEqualTo(false);

		assertThat(records("changer@consent.test")).hasSize(5)
			.filteredOn(row -> row.source().equals("settings"))
			.extracting("purpose", "granted")
			.containsExactly(tuple("ai", false));
	}

	@Test
	void withdrawingThePlatformPurposeMakesItNeededAgain() {
		String session = TestSignIn.sessionWithoutConsent(client, mail, "leaver@consent.test");
		put(session, Map.of("platform", true, "partners", true, "ai", false, "updates", false, "source", "accept_all"))
			.expectStatus()
			.isOk();

		put(session, Map.of("platform", false, "partners", true, "ai", false, "updates", false, "source", "settings"))
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.needed")
			.isEqualTo(true);
	}

	@Test
	void anIncompleteAnswerOrAnUnknownSourceIsRefused() {
		String session = TestSignIn.sessionWithoutConsent(client, mail, "sloppy@consent.test");

		put(session, Map.of("platform", true, "source", "choose")).expectStatus().isBadRequest();
		put(session, Map.of("platform", true, "partners", true, "ai", true, "updates", true, "source", "silence"))
			.expectStatus()
			.isBadRequest();
		client.get().uri(CONSENT).exchange().expectStatus().isUnauthorized();
		assertThat(records("sloppy@consent.test")).isEmpty();
	}

	@Test
	void theRecordCannotBeRewritten() {
		String session = TestSignIn.sessionWithoutConsent(client, mail, "proof@consent.test");
		put(session, Map.of("platform", true, "partners", true, "ai", true, "updates", true, "source", "accept_all"))
			.expectStatus()
			.isOk();
		UUID account = jdbc.sql("select id from identity_account where email = 'proof@consent.test'")
			.query(UUID.class)
			.single();

		assertThatThrownBy(() -> jdbc.sql("update identity_consent_record set granted = false where account_id = :id")
			.param("id", account)
			.update()).hasMessageContaining("append-only");
		assertThatThrownBy(() -> jdbc.sql("delete from identity_consent_record where account_id = :id")
			.param("id", account)
			.update()).hasMessageContaining("append-only");
	}

	private RestTestClient.ResponseSpec put(String session, Map<String, Object> body) {
		return client.put()
			.uri(CONSENT)
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body(body)
			.exchange();
	}

	private List<Row> records(String email) {
		return jdbc.sql("""
				select r.purpose, r.granted, r.version, r.source, r.request_id
				from identity_consent_record r join identity_account a on a.id = r.account_id
				where a.email = :email
				""")
			.param("email", email)
			.query((row, index) -> new Row(row.getString("purpose"), row.getBoolean("granted"), row.getInt("version"),
					row.getString("source"), row.getObject("request_id", UUID.class)))
			.list();
	}

	record Row(String purpose, boolean granted, int version, String source, UUID requestId) {
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
