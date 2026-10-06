package ai.genaifund.beyondpilot.introduction;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.RecordingMailSender;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import ai.genaifund.beyondpilot.storage.TestUploads;
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
 * Introductions over real HTTP against PostgreSQL: who may ask, what the provider's owners learn, and that an address
 * is shared only by the answer. Only the SMTP server is replaced. Each test uses its own email domains, because a
 * domain belongs to one organization.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@genaifund.test")
@Import({ TestcontainersConfiguration.class, IntroductionTest.Mail.class })
class IntroductionTest {

	private static final String ORGANIZATION = "/api/organization";

	private static final String SOLUTION = "/api/solution";

	private static final String INTRODUCTION = "/api/introduction";

	private static final String INTRODUCTIONS_ADMIN = INTRODUCTION + "/admin/introductions";

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
	void anApprovedOrganizationAsksAndTheOwnersLearnNoAddress() {
		String provider = organizationOwner("owner@ask-provider.test", "Ask Provider");
		String slug = listedSolution(provider, "Ask Triage");
		String buyer = organizationOwner("buyer@ask-buyer.test", "Ask Buyer");

		post(buyer, INTRODUCTION + "/introductions", Map.of("solutionSlug", slug, "message", "  We need claims triage.  "))
			.expectStatus()
			.isNoContent();

		assertThat(mail.latestSubjectTo("owner@ask-provider.test")).isEqualTo("A request for an introduction to Ask Triage");
		String text = mail.latestTextTo("owner@ask-provider.test");
		assertThat(text).contains("Ask Buyer").contains("We need claims triage.").doesNotContain("buyer@ask-buyer.test");
		String received = body(get(provider, INTRODUCTION + "/mine/received").expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(received, "$.editable")).isTrue();
		assertThat(JsonPath.<List<String>>read(received, "$.items[*].solutionName")).containsExactly("Ask Triage");
		assertThat(JsonPath.<String>read(received, "$.items[0].senderOrganization")).isEqualTo("Ask Buyer");
		assertThat(JsonPath.<String>read(received, "$.items[0].message")).isEqualTo("We need claims triage.");
		assertThat(JsonPath.<String>read(received, "$.items[0].status")).isEqualTo("pending");
		assertThat(JsonPath.<Object>read(received, "$.items[0].senderEmail")).isNull();
		// The sender reads nothing of it as a recipient.
		assertThat(JsonPath.<List<Object>>read(body(get(buyer, INTRODUCTION + "/mine/received").expectStatus().isOk()),
				"$.items")).isEmpty();
	}

	@Test
	void aRequestIsRefusedWhenItCannotBeAnswered() {
		String provider = organizationOwner("owner@refuse-provider.test", "Refuse Provider");
		String slug = listedSolution(provider, "Refuse Triage");
		String message = "Please introduce us.";

		assertProblem(post(signIn("loner@gmail.test"), INTRODUCTION + "/introductions",
				Map.of("solutionSlug", slug, "message", message)), 403, "INTRODUCTION_NEEDS_ORGANIZATION");
		String waiting = signIn("waiting@refuse-waiting.test");
		organization(waiting, "Refuse Waiting");
		assertProblem(post(waiting, INTRODUCTION + "/introductions", Map.of("solutionSlug", slug, "message", message)),
				403, "INTRODUCTION_ORGANIZATION_NOT_APPROVED");
		String buyer = organizationOwner("buyer@refuse-buyer.test", "Refuse Buyer");
		assertProblem(post(buyer, INTRODUCTION + "/introductions", Map.of("solutionSlug", "no-such", "message", message)),
				404, "INTRODUCTION_SOLUTION_NOT_FOUND");
		assertProblem(post(provider, INTRODUCTION + "/introductions", Map.of("solutionSlug", slug, "message", message)),
				409, "INTRODUCTION_OWN_SOLUTION");
		post(buyer, INTRODUCTION + "/introductions", Map.of("solutionSlug", slug, "message", " ")).expectStatus()
			.isBadRequest();

		post(buyer, INTRODUCTION + "/introductions", Map.of("solutionSlug", slug, "message", message)).expectStatus()
			.isNoContent();
		assertProblem(post(buyer, INTRODUCTION + "/introductions", Map.of("solutionSlug", slug, "message", message)),
				409, "INTRODUCTION_ALREADY_PENDING");
	}

	@Test
	void aSolutionLeftUnlistedIsStillAskedByItsAddress() {
		String provider = organizationOwner("owner@unlisted-provider.test", "Unlisted Provider");
		String slug = listedSolution(provider, "Unlisted Triage");
		String buyer = organizationOwner("buyer@unlisted-buyer.test", "Unlisted Buyer");
		UUID id = UUID.fromString(JsonPath
			.<List<String>>read(body(get(provider, SOLUTION + "/mine").expectStatus().isOk()),
					"$.items[?(@.name=='Unlisted Triage')].id")
			.get(0));
		String solution = body(get(provider, SOLUTION + "/mine/" + id).expectStatus().isOk());
		Map<String, Object> hidden = described("Unlisted Triage", JsonPath.<Number>read(solution, "$.version").longValue());
		hidden.put("listed", false);
		// A save keeps the images a reviewed solution has.
		hidden.put("logoFileId", JsonPath.<String>read(solution, "$.logo.fileId"));
		hidden.put("coverFileId", JsonPath.<String>read(solution, "$.cover.fileId"));
		put(provider, SOLUTION + "/mine/" + id, hidden).expectStatus().isOk();

		post(buyer, INTRODUCTION + "/introductions", Map.of("solutionSlug", slug, "message", "Hello.")).expectStatus()
			.isNoContent();
	}

	@Test
	void aReplyIntroducesBothSidesAndAfterItAnotherRequestIsAsked() {
		String provider = organizationOwner("owner@reply-provider.test", "Reply Provider");
		String slug = listedSolution(provider, "Reply Triage");
		String buyer = organizationOwner("buyer@reply-buyer.test", "Reply Buyer");
		ask(buyer, slug, "We need claims triage.");
		UUID id = firstReceived(provider);

		post(provider, INTRODUCTION + "/mine/received/" + id + "/reply", null).expectStatus().isNoContent();

		assertThat(mail.latestSubjectTo("buyer@reply-buyer.test")).isEqualTo("Your introduction about Reply Triage");
		assertThat(mail.latestTextTo("buyer@reply-buyer.test")).contains("owner@reply-provider.test")
			.contains("Reply Provider");
		assertThat(mail.latestTextTo("owner@reply-provider.test")).contains("buyer@reply-buyer.test")
			.contains("Reply Buyer");
		String received = body(get(provider, INTRODUCTION + "/mine/received").expectStatus().isOk());
		assertThat(JsonPath.<String>read(received, "$.items[0].status")).isEqualTo("replied");
		assertThat(JsonPath.<String>read(received, "$.items[0].senderEmail")).isEqualTo("buyer@reply-buyer.test");
		assertProblem(post(provider, INTRODUCTION + "/mine/received/" + id + "/reply", null), 409,
				"INTRODUCTION_NOT_PENDING");
		assertProblem(post(provider, INTRODUCTION + "/mine/received/" + id + "/decline", null), 409,
				"INTRODUCTION_NOT_PENDING");
		assertThat(events(id)).containsExactly("introduction.reply");
		// The earlier one is answered, so the buyer may ask again.
		ask(buyer, slug, "One more question.");
	}

	@Test
	void aDeclineTellsTheSenderWithoutAnAddress() {
		String provider = organizationOwner("owner@decline-provider.test", "Decline Provider");
		String slug = listedSolution(provider, "Decline Triage");
		String buyer = organizationOwner("buyer@decline-buyer.test", "Decline Buyer");
		ask(buyer, slug, "We need claims triage.");
		UUID id = firstReceived(provider);

		post(provider, INTRODUCTION + "/mine/received/" + id + "/decline", null).expectStatus().isNoContent();

		assertThat(mail.latestSubjectTo("buyer@decline-buyer.test")).isEqualTo("Your request about Decline Triage");
		assertThat(mail.latestTextTo("buyer@decline-buyer.test")).contains("Decline Provider")
			.doesNotContain("owner@decline-provider.test");
		String received = body(get(provider, INTRODUCTION + "/mine/received").expectStatus().isOk());
		assertThat(JsonPath.<String>read(received, "$.items[0].status")).isEqualTo("declined");
		assertThat(JsonPath.<Object>read(received, "$.items[0].senderEmail")).isNull();
		assertThat(events(id)).containsExactly("introduction.decline");
	}

	@Test
	void onlyAnOwnerOfTheOrganizationAskedAnswers() {
		String provider = organizationOwner("owner@only-provider.test", "Only Provider");
		String slug = listedSolution(provider, "Only Triage");
		String buyer = organizationOwner("buyer@only-buyer.test", "Only Buyer");
		ask(buyer, slug, "We need claims triage.");
		UUID id = firstReceived(provider);

		// Another organization's owner finds nothing at that identifier, and a person without one is told to belong to one.
		assertProblem(post(buyer, INTRODUCTION + "/mine/received/" + id + "/reply", null), 404,
				"INTRODUCTION_REQUEST_NOT_FOUND");
		assertProblem(post(signIn("loner@only-gmail.test"), INTRODUCTION + "/mine/received/" + id + "/reply", null), 403,
				"INTRODUCTION_NEEDS_ORGANIZATION");
		assertProblem(post(provider, INTRODUCTION + "/mine/received/" + UUID.randomUUID() + "/reply", null), 404,
				"INTRODUCTION_REQUEST_NOT_FOUND");
		assertProblem(get(signIn("loner@only-gmail.test"), INTRODUCTION + "/mine/received"), 403,
				"INTRODUCTION_NEEDS_ORGANIZATION");
	}

	@Test
	void anOperatorReadsTheRequestsInFullWithoutAnAddressAndSeesWhichWaitTooLong() {
		String provider = organizationOwner("owner@admin-provider.test", "Admin Provider");
		String slug = listedSolution(provider, "Admin Triage");
		String buyer = organizationOwner("buyer@admin-buyer.test", "Admin Buyer");
		ask(buyer, slug, "We need claims triage, in full.");
		UUID id = firstReceived(provider);

		String waiting = body(get(operator, INTRODUCTIONS_ADMIN + "?q=admin triage").expectStatus().isOk());

		assertThat(JsonPath.<List<String>>read(waiting, "$.items[*].message")).containsExactly("We need claims triage, in full.");
		assertThat(JsonPath.<String>read(waiting, "$.items[0].providerOrganization")).isEqualTo("Admin Provider");
		assertThat(JsonPath.<String>read(waiting, "$.items[0].senderOrganization")).isEqualTo("Admin Buyer");
		assertThat(JsonPath.<Boolean>read(waiting, "$.items[0].overdue")).isFalse();
		assertThat(waiting).doesNotContain("buyer@admin-buyer.test");
		jdbc.sql("update introduction_request set created_at = now() - interval '4 days' where id = ?")
			.param(id)
			.update();
		String overdue = body(get(operator, INTRODUCTIONS_ADMIN + "?q=admin triage&status=pending").expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(overdue, "$.items[0].overdue")).isTrue();
		assertThat(JsonPath.<Number>read(overdue, "$.overdue").longValue()).isGreaterThanOrEqualTo(1);
		post(provider, INTRODUCTION + "/mine/received/" + id + "/decline", null).expectStatus().isNoContent();
		String declined = body(get(operator, INTRODUCTIONS_ADMIN + "?q=admin triage").expectStatus().isOk());
		assertThat(JsonPath.<String>read(declined, "$.items[0].status")).isEqualTo("declined");
		assertThat(JsonPath.<Boolean>read(declined, "$.items[0].overdue")).isFalse();
		assertThat(JsonPath.<List<Object>>read(
				body(get(operator, INTRODUCTIONS_ADMIN + "?q=admin triage&status=pending").expectStatus().isOk()),
				"$.items")).isEmpty();
		// Only an operator reads them.
		assertProblem(get(buyer, INTRODUCTIONS_ADMIN), 403, "IDENTITY_OPERATOR_REQUIRED");
		client.get().uri(INTRODUCTIONS_ADMIN).exchange().expectStatus().isUnauthorized();
	}

	@Test
	void everythingNeedsASession() {
		client.get().uri(INTRODUCTION + "/mine/received").exchange().expectStatus().isUnauthorized();
		client.post()
			.uri(INTRODUCTION + "/introductions")
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("solutionSlug", "any", "message", "Hello."))
			.exchange()
			.expectStatus()
			.isUnauthorized();
	}

	private void ask(String session, String slug, String message) {
		post(session, INTRODUCTION + "/introductions", Map.of("solutionSlug", slug, "message", message)).expectStatus()
			.isNoContent();
	}

	private UUID firstReceived(String owner) {
		return UUID.fromString(JsonPath.read(body(get(owner, INTRODUCTION + "/mine/received").expectStatus().isOk()),
				"$.items[0].id"));
	}

	/** A solution as its edit screen sends it, with what a submission needs. */
	private static Map<String, Object> described(String name, long version) {
		Map<String, Object> request = new HashMap<>();
		request.put("name", name);
		request.put("summary", "Reads claim files.");
		request.put("problemsSolved", null);
		request.put("valueProposition", null);
		request.put("focusAreas", List.of("document_processing"));
		request.put("industries", List.of("insurance"));
		request.put("maturity", "pilot");
		request.put("builtWith", List.of());
		request.put("languages", List.of());
		request.put("deployment", List.of("cloud_saas"));
		request.put("website", "https://example.test");
		request.put("imageFileIds", List.of());
		request.put("listed", true);
		request.put("version", version);
		return request;
	}

	private UUID organization(String session, String name) {
		return UUID.fromString(JsonPath.read(body(post(session, ORGANIZATION + "/organizations",
				Map.of("name", name, "type", "company", "country", "VN", "teamSize", "2_9",
						"industries", List.of("insurance"), "website", "https://example.test", "description",
						"Assistants for insurers.", "foundedYear", 2021, "jobTitle", "Founder"))
			.expectStatus()
			.isCreated()), "$.id"));
	}

	/** The session of the owner of an approved organization. */
	private String organizationOwner(String email, String name) {
		String session = signIn(email);
		UUID organization = organization(session, name);
		post(operator, ORGANIZATION + "/admin/organizations/" + organization + "/approve", Map.of()).expectStatus()
			.isNoContent();
		return session;
	}

	/** Makes an approved, listed solution of the provider's organization and returns its address. */
	private String listedSolution(String provider, String name) {
		String draft = body(post(provider, SOLUTION + "/mine", Map.of("name", name)).expectStatus().isCreated());
		UUID id = UUID.fromString(JsonPath.read(draft, "$.id"));
		Map<String, Object> request = described(name, JsonPath.<Number>read(draft, "$.version").longValue());
		// A review asks for a logo and a cover.
		request.put("logoFileId", TestUploads.image(client, provider, "solution_logo", "logo.png"));
		request.put("coverFileId", TestUploads.image(client, provider, "solution_image", "cover.png"));
		put(provider, SOLUTION + "/mine/" + id, request).expectStatus().isOk();
		post(provider, SOLUTION + "/mine/" + id + "/submit", null).expectStatus().isOk();
		post(operator, SOLUTION + "/admin/solutions/" + id + "/approve", Map.of()).expectStatus().isNoContent();
		return JsonPath.read(body(get(provider, SOLUTION + "/mine/" + id).expectStatus().isOk()), "$.slug");
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

	private List<String> events(UUID request) {
		return jdbc.sql("""
				select action from audit_event where resource_type = 'introduction' and resource_id = ?
				order by occurred_at, id
				""").param(request.toString()).query(String.class).list();
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
