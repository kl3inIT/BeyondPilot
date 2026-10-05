package ai.genaifund.beyondpilot.talent;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.RecordingMailSender;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Talent profiles over real HTTP against PostgreSQL: the one profile a person keeps, what a submission needs, what
 * operators decide, what the public directory shows and how a message reaches a person. Only the SMTP server is
 * replaced. Each test uses its own word in the names it searches for, because the tests share one database.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@genaifund.test")
@Import({ TestcontainersConfiguration.class, TalentTest.Mail.class })
class TalentTest {

	private static final String MINE = "/api/talent/mine";

	private static final String ADMIN = "/api/talent/admin/profiles";

	private static final String DIRECTORY = "/api/talent/profiles";

	@LocalServerPort
	private int port;

	@Autowired
	private RecordingMailSender mail;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
		operator = signIn("operator@genaifund.test");
	}

	@Test
	void aPersonHasOneProfileAndALaterSaveNeedsItsVersion() {
		String person = signIn("one@profile.test");
		assertThat(JsonPath.<Object>read(mine(person), "$.profile")).isNull();

		String created = body(put(person, MINE, described("  Một Người  ", null)).expectStatus().isOk());

		assertThat(JsonPath.<String>read(created, "$.name")).isEqualTo("Một Người");
		assertThat(JsonPath.<String>read(created, "$.slug")).isEqualTo("mot-nguoi");
		assertThat(JsonPath.<String>read(created, "$.status")).isEqualTo("draft");
		assertThat(JsonPath.<List<String>>read(created, "$.projects[*].title")).containsExactly("Claims triage");
		// A second first save is a stale screen, not a second profile.
		assertProblem(put(person, MINE, described("Another Person", null)), 409, "TALENT_CHANGED_MEANWHILE");
		Map<String, Object> change = described("Một Người", versionOf(created));
		change.put("headline", "Builds document AI");
		change.put("projects", List.of());
		String saved = body(put(person, MINE, change).expectStatus().isOk());

		assertThat(versionOf(saved)).isGreaterThan(versionOf(created));
		assertThat(JsonPath.<String>read(saved, "$.id")).isEqualTo(JsonPath.<String>read(created, "$.id"));
		assertProblem(put(person, MINE, described("Overwritten", versionOf(created))), 409, "TALENT_CHANGED_MEANWHILE");
		String now = mine(person);
		assertThat(JsonPath.<String>read(now, "$.profile.headline")).isEqualTo("Builds document AI");
		assertThat(JsonPath.<List<Object>>read(now, "$.profile.projects")).isEmpty();
	}

	@Test
	void aSaveOutOfBoundsIsAValidationProblemThatPointsAtIt() {
		Map<String, Object> request = described("Out Of Bounds", null);
		request.put("roles", List.of("wizard"));
		request.put("country", "vn");
		request.put("website", "example.test");
		request.put("projects", List.of(Map.of("title", " ")));

		String body = body(put(signIn("bounds@profile.test"), MINE, request).expectStatus().isBadRequest());

		assertThat(JsonPath.<String>read(body, "$.code")).isEqualTo("REQUEST_INVALID");
		assertThat(JsonPath.<List<String>>read(body, "$.errors[*].pointer")).containsExactlyInAnyOrder("#/roles/0",
				"#/country", "#/website", "#/projects/0/title");
	}

	@Test
	void aSubmissionNeedsAHeadlineABioARoleAndASkill() {
		String person = signIn("sender@profile.test");
		assertProblem(post(person, MINE + "/submit", null), 404, "TALENT_PROFILE_NOT_FOUND");
		Map<String, Object> bare = described("Bare Profile", null);
		bare.put("headline", null);
		bare.put("skills", List.of());
		String draft = body(put(person, MINE, bare).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(draft, "$.complete")).isFalse();
		assertProblem(post(person, MINE + "/submit", null), 400, "TALENT_INCOMPLETE");

		put(person, MINE, described("Bare Profile", versionOf(draft))).expectStatus().isOk();
		String submitted = body(post(person, MINE + "/submit", null).expectStatus().isOk());

		assertThat(JsonPath.<String>read(submitted, "$.status")).isEqualTo("submitted");
		assertProblem(post(person, MINE + "/submit", null), 409, "TALENT_NOT_SUBMITTABLE");
		// What operators review keeps what a submission needs.
		bare.put("version", versionOf(submitted));
		assertProblem(put(person, MINE, bare), 400, "TALENT_INCOMPLETE");
	}

	@Test
	void anOperatorRejectsWithAReasonAndApprovesWhatIsSentAgain() {
		String person = signIn("reviewed@profile.test");
		UUID id = submitted(person, "Reviewed Person");
		String drafter = signIn("drafter@profile.test");
		UUID draft = UUID.fromString(
				JsonPath.read(body(put(drafter, MINE, described("Unsent Person", null)).expectStatus().isOk()), "$.id"));

		assertProblem(post(person, ADMIN + "/" + id + "/approve", null), 403, "IDENTITY_OPERATOR_REQUIRED");
		// Operators see what was sent to them, never a draft.
		assertProblem(get(operator, ADMIN + "/" + draft), 404, "TALENT_PROFILE_NOT_FOUND");
		String forOperator = body(get(operator, ADMIN + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(forOperator, "$.email")).isEqualTo("reviewed@profile.test");
		assertThat(JsonPath.<String>read(forOperator, "$.profile.status")).isEqualTo("submitted");
		assertProblem(post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "boring")), 400, "REQUEST_INVALID");
		post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "incomplete", "message", "Say what you built."))
			.expectStatus()
			.isNoContent();

		String rejected = mine(person);
		assertThat(JsonPath.<String>read(rejected, "$.profile.status")).isEqualTo("rejected");
		assertThat(JsonPath.<String>read(rejected, "$.profile.decisionReason")).isEqualTo("incomplete");
		assertThat(JsonPath.<String>read(rejected, "$.profile.decisionMessage")).isEqualTo("Say what you built.");
		assertProblem(post(operator, ADMIN + "/" + id + "/approve", null), 409, "TALENT_NOT_AWAITING_REVIEW");

		post(person, MINE + "/submit", null).expectStatus().isOk();
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();

		assertThat(JsonPath.<String>read(mine(person), "$.profile.status")).isEqualTo("approved");
		assertThat(events(id)).containsExactly("talent.reject", "talent.approve");
		// A decision is made once.
		assertProblem(post(operator, ADMIN + "/" + id + "/approve", null), 409, "TALENT_NOT_AWAITING_REVIEW");
	}

	@Test
	void anOperatorTakesAnApprovedProfileOutOfTheDirectory() {
		String person = signIn("removed@profile.test");
		UUID id = approved(person, "Removed Person");
		client.get().uri(DIRECTORY + "/removed-person").exchange().expectStatus().isOk();

		post(operator, ADMIN + "/" + id + "/reject", Map.of("reason", "inappropriate")).expectStatus().isNoContent();

		assertProblem(client.get().uri(DIRECTORY + "/removed-person").exchange(), 404, "TALENT_PROFILE_NOT_FOUND");
		assertThat(JsonPath.<String>read(mine(person), "$.profile.status")).isEqualTo("rejected");
		assertThat(events(id)).containsExactly("talent.approve", "talent.reject");
	}

	@Test
	void theDirectoryShowsOnlyApprovedListedProfilesWithoutTheirAddress() {
		approved(signIn("wombat.engineer@profile.test"), "Wombat Engineer");
		Map<String, Object> scientist = described("Wombat Scientist", null);
		scientist.put("roles", List.of("data_scientist"));
		scientist.put("availability", "not_available");
		approved(signIn("wombat.scientist@profile.test"), scientist);
		Map<String, Object> hidden = described("Wombat Hidden", null);
		hidden.put("listed", false);
		approved(signIn("wombat.hidden@profile.test"), hidden);
		submitted(signIn("wombat.waiting@profile.test"), "Wombat Waiting");
		put(signIn("wombat.draft@profile.test"), MINE, described("Wombat Draft", null)).expectStatus().isOk();

		// Anyone reads the directory, without a session.
		String all = body(client.get().uri(DIRECTORY + "?q=WOMBAT").exchange().expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(all, "$.items[*].name")).containsExactly("Wombat Engineer",
				"Wombat Scientist");
		assertThat(JsonPath.<Integer>read(all, "$.total")).isEqualTo(2);
		assertThat(all).doesNotContain("@profile.test");
		assertThat(names(DIRECTORY + "?q=wombat&role=data_scientist")).containsExactly("Wombat Scientist");
		assertThat(names(DIRECTORY + "?q=wombat&availability=available")).containsExactly("Wombat Engineer");
		// A skill is searched too.
		assertThat(names(DIRECTORY + "?q=langgraph")).contains("Wombat Engineer", "Wombat Scientist");
		// The most recently approved comes first when that order is asked for.
		assertThat(names(DIRECTORY + "?q=wombat&sort=newest")).containsExactly("Wombat Scientist", "Wombat Engineer");
		assertProblem(client.get().uri(DIRECTORY + "?role=wizard").exchange(), 400, "REQUEST_INVALID");
		assertProblem(client.get().uri(DIRECTORY + "?sort=random").exchange(), 400, "REQUEST_INVALID");

		String one = body(client.get().uri(DIRECTORY + "/wombat-engineer").exchange().expectStatus().isOk());
		assertThat(JsonPath.<String>read(one, "$.headline")).isEqualTo("Builds claims AI");
		assertThat(JsonPath.<List<String>>read(one, "$.projects[*].title")).containsExactly("Claims triage");
		assertThat(one).doesNotContain("@profile.test");
		// An address does not reveal a profile that is not shown.
		for (String slug : List.of("wombat-hidden", "wombat-waiting", "wombat-draft")) {
			assertProblem(client.get().uri(DIRECTORY + "/" + slug).exchange(), 404, "TALENT_PROFILE_NOT_FOUND");
		}

		// Operators read everything that was sent, those that wait first, and never a draft.
		String forOperators = body(get(operator, ADMIN + "?q=wombat").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(forOperators, "$.total")).isEqualTo(4);
		assertThat(JsonPath.<String>read(forOperators, "$.items[0].name")).isEqualTo("Wombat Waiting");
		assertThat(JsonPath.<String>read(forOperators, "$.items[0].email")).isEqualTo("wombat.waiting@profile.test");
		assertProblem(get(signIn("visitor@profile.test"), ADMIN), 403, "IDENTITY_OPERATOR_REQUIRED");
	}

	@Test
	void aSignedInPersonWritesToAProfileOnceADayAndItsPersonReadsIt() {
		String person = signIn("numbat@profile.test");
		approved(person, "Numbat Person");
		String path = DIRECTORY + "/numbat-person/enquiries";
		Map<String, Object> message = Map.of("message", "  We need a claims model by March.  ");

		client.post()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body(message)
			.exchange()
			.expectStatus()
			.isUnauthorized();
		assertProblem(post(person, path, message), 409, "TALENT_OWN_PROFILE");
		String buyer = signIn("buyer@enterprise.test");
		assertProblem(post(buyer, path, Map.of("message", " ")), 400, "REQUEST_INVALID");
		assertProblem(post(buyer, DIRECTORY + "/nobody-here/enquiries", message), 404, "TALENT_PROFILE_NOT_FOUND");

		post(buyer, path, message).expectStatus().isNoContent();

		assertProblem(post(buyer, path, message), 429, "TALENT_ENQUIRY_TOO_SOON");
		String read = mine(person);
		assertThat(JsonPath.<List<String>>read(read, "$.enquiries[*].message"))
			.containsExactly("We need a claims model by March.");
		assertThat(JsonPath.<String>read(read, "$.enquiries[0].senderEmail")).isEqualTo("buyer@enterprise.test");
		assertThat(mail.latestSubjectTo("numbat@profile.test"))
			.isEqualTo("A message through your BeyondPilot talent profile");
		// The sender reads nothing of it on their own page.
		assertThat(JsonPath.<List<Object>>read(mine(buyer), "$.enquiries")).isEmpty();
	}

	@Test
	void everythingButTheDirectoryNeedsASession() {
		client.get().uri(DIRECTORY).exchange().expectStatus().isOk();

		client.get().uri(MINE).exchange().expectStatus().isUnauthorized();
		client.get().uri(ADMIN).exchange().expectStatus().isUnauthorized();
	}

	/** A profile as its edit screen sends it, with what a submission needs. */
	private static Map<String, Object> described(String name, Long version) {
		Map<String, Object> request = new HashMap<>();
		request.put("name", name);
		request.put("headline", "Builds claims AI");
		request.put("bio", "Ten years of machine learning in insurance.");
		request.put("roles", List.of("ml_engineer"));
		request.put("skills", List.of("Python", "LangGraph"));
		request.put("country", "VN");
		request.put("availability", "available");
		request.put("engagement", List.of("contract"));
		request.put("rateBand", "50_100");
		request.put("website", "https://example.test");
		request.put("projects", List.of(Map.of("title", "Claims triage", "year", 2025)));
		request.put("listed", true);
		request.put("version", version);
		return request;
	}

	private static long versionOf(String profile) {
		return JsonPath.<Number>read(profile, "$.version").longValue();
	}

	private UUID submitted(String session, String name) {
		return submitted(session, described(name, null));
	}

	private UUID submitted(String session, Map<String, Object> description) {
		put(session, MINE, description).expectStatus().isOk();
		return UUID.fromString(JsonPath.read(body(post(session, MINE + "/submit", null).expectStatus().isOk()), "$.id"));
	}

	private UUID approved(String session, String name) {
		return approved(session, described(name, null));
	}

	private UUID approved(String session, Map<String, Object> description) {
		UUID id = submitted(session, description);
		post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isNoContent();
		return id;
	}

	private String mine(String session) {
		return body(get(session, MINE).expectStatus().isOk());
	}

	private List<String> names(String path) {
		return JsonPath.read(body(client.get().uri(path).exchange().expectStatus().isOk()), "$.items[*].name");
	}

	private RestTestClient.ResponseSpec get(String session, String path) {
		return client.get().uri(path).cookie(TestSignIn.SESSION_COOKIE, session).exchange();
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

	private String signIn(String email) {
		return TestSignIn.session(client, mail, email);
	}

	private List<String> events(UUID profile) {
		return jdbc.sql("""
				select action from audit_event where resource_type = 'talent' and resource_id = ?
				order by occurred_at, id
				""").param(profile.toString()).query(String.class).list();
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

	@TestConfiguration(proxyBeanMethods = false)
	static class Mail {

		@Bean
		RecordingMailSender recordingMailSender() {
			return new RecordingMailSender();
		}

	}

}
