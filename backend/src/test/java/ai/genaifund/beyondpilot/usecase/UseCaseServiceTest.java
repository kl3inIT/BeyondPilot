package ai.genaifund.beyondpilot.usecase;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
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
 * What the members of an organization do with its use cases, over real HTTP against PostgreSQL: who may, a draft written
 * in parts and saved by two people, what sending it for review needs and does, what is locked, and what the audit trail
 * keeps. Each test uses its own email domain, because a domain belongs to one organization.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@members.test")
@Import({ TestcontainersConfiguration.class, UseCaseServiceTest.Mail.class })
class UseCaseServiceTest {

	private static final String MINE = "/api/usecase/mine";

	private static final String ORGANIZATION = "/api/organization";

	private static final String ADMIN = "/api/usecase/admin/use-cases";

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
		operator = TestSignIn.session(client, mail, "operator@members.test");
	}

	@Test
	void onlyTheMembersOfAnApprovedOrganizationWriteItsUseCases() {
		Team team = team("gate.test", true);
		UUID mine = create(team.founder);
		String stranger = TestSignIn.session(client, mail, "stranger@elsewhere.test");
		Team pending = team("pending.test", false);

		client.get().uri(MINE).exchange().expectStatus().isUnauthorized();
		for (String session : List.of(stranger, pending.founder)) {
			assertProblem(get(session, MINE), 403, "USECASE_ENTERPRISE_REQUIRED");
			assertProblem(post(session, MINE, null), 403, "USECASE_ENTERPRISE_REQUIRED");
			assertProblem(get(session, MINE + "/" + mine), 403, "USECASE_ENTERPRISE_REQUIRED");
		}
		get(team.colleague, MINE + "/" + mine).expectStatus().isOk();
	}

	@Test
	void aDraftIsWrittenInPartsAndSavedByAnyMember() {
		Team team = team("parts.test", true);
		UUID id = create(team.founder);
		String empty = body(get(team.founder, MINE + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(empty, "$.status")).isEqualTo("draft");
		assertThat(JsonPath.<Boolean>read(empty, "$.editable")).isTrue();
		assertThat(JsonPath.<Boolean>read(empty, "$.complete")).isFalse();
		assertThat(JsonPath.<Object>read(empty, "$.title")).isNull();
		assertThat(JsonPath.<Boolean>read(empty, "$.lastEditedBy.you")).isTrue();

		Map<String, Object> partial = save(0);
		partial.put("title", "  Voice-enabled navigation  ");
		partial.put("technologies", List.of("voice_ai", "voice_ai"));
		partial.put("requirements", List.of(Map.of("statement", " Understand Vietnamese ", "necessity", "required")));
		String first = body(put(team.founder, MINE + "/" + id, partial).expectStatus().isOk());
		assertThat(JsonPath.<String>read(first, "$.title")).isEqualTo("Voice-enabled navigation");
		assertThat(JsonPath.<List<String>>read(first, "$.technologies")).containsExactly("voice_ai");
		assertThat(JsonPath.<String>read(first, "$.requirements[0].statement")).isEqualTo("Understand Vietnamese");
		assertThat(JsonPath.<Number>read(first, "$.version").longValue()).isEqualTo(1);

		String seenByColleague = body(get(team.colleague, MINE).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(seenByColleague, "$.items[*].title"))
			.containsExactly("Voice-enabled navigation");
		assertThat(JsonPath.<Boolean>read(seenByColleague, "$.items[0].lastEditedBy.you")).isFalse();
		assertThat(JsonPath.<Boolean>read(seenByColleague, "$.items[0].lastEditedBy.genaiFund")).isFalse();

		Map<String, Object> second = save(1);
		second.put("title", "Voice-enabled navigation, v2");
		put(team.colleague, MINE + "/" + id, second).expectStatus().isOk();
		assertProblem(put(team.founder, MINE + "/" + id, save(1)), 409, "USECASE_CHANGED_MEANWHILE");
	}

	@Test
	void aPartThatCannotStandIsRefusedWhateverIsMissing() {
		Team team = team("refuse.test", true);
		UUID id = create(team.founder);

		Map<String, Object> upsideDown = save(0);
		upsideDown.put("budgetMin", 50000);
		upsideDown.put("budgetMax", 10000);
		assertProblem(put(team.founder, MINE + "/" + id, upsideDown), 400, "USECASE_BUDGET_OUT_OF_ORDER");

		Map<String, Object> half = save(0);
		half.put("budgetMin", 1000);
		assertProblem(put(team.founder, MINE + "/" + id, half), 400, "USECASE_BUDGET_INCOMPLETE");

		Map<String, Object> slow = save(0);
		slow.put("timelineMinWeeks", 12);
		slow.put("timelineMaxWeeks", 8);
		assertProblem(put(team.founder, MINE + "/" + id, slow), 400, "USECASE_TIMELINE_OUT_OF_ORDER");

		Map<String, Object> past = save(0);
		past.put("closesAt", Instant.now().minus(1, ChronoUnit.DAYS).toString());
		assertProblem(put(team.founder, MINE + "/" + id, past), 400, "USECASE_CLOSES_IN_THE_PAST");

		Map<String, Object> unknown = save(0);
		unknown.put("industry", "space_mining");
		put(team.founder, MINE + "/" + id, unknown).expectStatus().isBadRequest();

		assertThat(JsonPath.<Number>read(body(get(team.founder, MINE + "/" + id).expectStatus().isOk()), "$.version")
			.longValue()).isZero();
	}

	@Test
	void aUseCaseIsSentForReviewWhenComplete_andThenItsMembersCannotEditIt() {
		Team team = team("review.test", true);
		UUID id = create(team.founder);

		assertProblem(post(team.founder, MINE + "/" + id + "/submit", null), 400, "USECASE_INCOMPLETE");
		put(team.founder, MINE + "/" + id, complete(0)).expectStatus().isOk();

		String sent = body(post(team.colleague, MINE + "/" + id + "/submit", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(sent, "$.status")).isEqualTo("in_review");
		assertThat(JsonPath.<Boolean>read(sent, "$.editable")).isFalse();
		assertThat(JsonPath.<Boolean>read(sent, "$.submittedBy.you")).isTrue();
		assertThat(JsonPath.<String>read(sent, "$.submittedAt")).isNotNull();

		long version = JsonPath.<Number>read(sent, "$.version").longValue();
		assertProblem(put(team.founder, MINE + "/" + id, complete(version)), 409, "USECASE_NOT_EDITABLE");
		assertProblem(post(team.founder, MINE + "/" + id + "/submit", null), 409, "USECASE_NOT_SUBMITTABLE");
		assertThat(events(id)).containsExactly("use_case.submit");

		String back = body(post(team.founder, MINE + "/" + id + "/draft", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(back, "$.status")).isEqualTo("draft");
		assertThat(JsonPath.<Boolean>read(back, "$.editable")).isTrue();
		assertThat(events(id)).containsExactly("use_case.submit", "use_case.draft");
		assertProblem(post(team.founder, MINE + "/" + id + "/draft", null), 409, "USECASE_CANNOT_MOVE_TO_DRAFT");
	}

	@Test
	void aPublishedUseCaseBecomesADraftWhenItsMembersEditItOrTakeItBack() {
		Team team = team("published.test", true);
		UUID first = adminPublished(team.organization, "Published one");
		UUID second = adminPublished(team.organization, "Published two");

		String listed = body(get(team.founder, MINE).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(listed, "$.items[*].status")).containsOnly("published");
		assertThat(JsonPath.<Boolean>read(listed, "$.items[0].lastEditedBy.genaiFund")).isTrue();

		String edited = body(put(team.founder, MINE + "/" + first, complete(0)).expectStatus().isOk());
		assertThat(JsonPath.<String>read(edited, "$.status")).isEqualTo("draft");
		assertThat(JsonPath.<Object>read(edited, "$.publishedAt")).isNull();

		String back = body(post(team.founder, MINE + "/" + second + "/draft", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(back, "$.status")).isEqualTo("draft");
		assertThat(events(second)).containsExactly("use_case.draft");
	}

	@Test
	void aClosedUseCaseIsLockedForItsMembers() {
		Team team = team("closed.test", true);
		UUID id = adminPublished(team.organization, "Closing soon");
		jdbc.sql("update use_case set closes_at = now() - interval '1 day' where id = ?").param(id).update();

		String closed = body(get(team.founder, MINE + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(closed, "$.status")).isEqualTo("closed");
		assertThat(JsonPath.<Boolean>read(closed, "$.editable")).isFalse();
		long version = JsonPath.<Number>read(closed, "$.version").longValue();
		assertProblem(put(team.founder, MINE + "/" + id, complete(version)), 409, "USECASE_NOT_EDITABLE");
		assertProblem(post(team.founder, MINE + "/" + id + "/draft", null), 409, "USECASE_CANNOT_MOVE_TO_DRAFT");
		assertProblem(post(team.founder, MINE + "/" + id + "/submit", null), 409, "USECASE_NOT_SUBMITTABLE");
	}

	@Test
	void aUseCaseOfAnotherOrganizationIsNotFound() {
		Team ours = team("ours.test", true);
		Team theirs = team("theirs.test", true);
		UUID id = create(theirs.founder);

		assertProblem(get(ours.founder, MINE + "/" + id), 404, "USECASE_NOT_FOUND");
		assertProblem(put(ours.founder, MINE + "/" + id, save(0)), 404, "USECASE_NOT_FOUND");
		assertProblem(post(ours.founder, MINE + "/" + id + "/submit", null), 404, "USECASE_NOT_FOUND");
		assertProblem(post(ours.founder, MINE + "/" + id + "/draft", null), 404, "USECASE_NOT_FOUND");
		String list = body(get(ours.founder, MINE).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[*].id")).doesNotContain(id.toString());
	}

	@Test
	void anOperatorApprovesAUseCaseInReviewAndItsMembersAreTold() {
		Team team = team("approve.test", true);
		UUID id = create(team.founder);
		put(team.founder, MINE + "/" + id, complete(0)).expectStatus().isOk();
		post(team.colleague, MINE + "/" + id + "/submit", null).expectStatus().isOk();

		assertProblem(post(team.founder, ADMIN + "/" + id + "/approve", null), 403, "IDENTITY_OPERATOR_REQUIRED");
		String read = body(get(operator, ADMIN + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(read, "$.status")).isEqualTo("in_review");
		assertThat(JsonPath.<String>read(read, "$.submittedBy.name")).isEqualTo("colleague@approve.test");
		assertThat(JsonPath.<String>read(read, "$.createdBy.name")).isEqualTo("founder@approve.test");
		assertThat(JsonPath.<String>read(read, "$.submittedAt")).isNotNull();

		String approved = body(post(operator, ADMIN + "/" + id + "/approve", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(approved, "$.status")).isEqualTo("published");
		assertThat(JsonPath.<String>read(approved, "$.publishedAt")).isNotNull();
		assertThat(JsonPath.<Boolean>read(approved, "$.reviewedBy.genaiFund")).isTrue();
		assertThat(JsonPath.<String>read(body(get(team.founder, MINE + "/" + id).expectStatus().isOk()), "$.status"))
			.isEqualTo("published");
		assertThat(events(id)).containsExactly("use_case.submit", "use_case.approve");
		assertThat(mail.latestSubjectTo("founder@approve.test")).contains("is published");
		assertThat(mail.latestSubjectTo("colleague@approve.test")).contains("is published");
		assertProblem(post(operator, ADMIN + "/" + id + "/approve", null), 409, "USECASE_NOT_AWAITING_REVIEW");
	}

	@Test
	void anOperatorSendsAUseCaseBackWithAReasonThatItsMembersReadUntilTheySendItAgain() {
		Team team = team("sendback.test", true);
		UUID id = create(team.founder);
		put(team.founder, MINE + "/" + id, complete(0)).expectStatus().isOk();
		post(team.founder, MINE + "/" + id + "/submit", null).expectStatus().isOk();

		assertProblem(post(team.founder, ADMIN + "/" + id + "/send-back", Map.of("reason", "Too vague")), 403,
				"IDENTITY_OPERATOR_REQUIRED");
		post(operator, ADMIN + "/" + id + "/send-back", Map.of("reason", "   ")).expectStatus().isBadRequest();

		String sent = body(post(operator, ADMIN + "/" + id + "/send-back",
				Map.of("reason", "  The problem statement is too vague.  "))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(sent, "$.status")).isEqualTo("needs_changes");
		assertThat(JsonPath.<String>read(sent, "$.reviewNote")).isEqualTo("The problem statement is too vague.");
		assertThat(mail.latestSubjectTo("founder@sendback.test")).contains("Changes needed");
		assertProblem(post(operator, ADMIN + "/" + id + "/send-back", Map.of("reason", "Again")), 409,
				"USECASE_NOT_AWAITING_REVIEW");

		String read = body(get(team.founder, MINE + "/" + id).expectStatus().isOk());
		assertThat(JsonPath.<String>read(read, "$.status")).isEqualTo("needs_changes");
		assertThat(JsonPath.<String>read(read, "$.reviewNote")).isEqualTo("The problem statement is too vague.");
		assertThat(JsonPath.<Boolean>read(read, "$.editable")).isTrue();

		long version = JsonPath.<Number>read(read, "$.version").longValue();
		Map<String, Object> better = complete(version);
		better.put("problemStatement", "Owners lose track of renewal dates and call the hotline 400 times a day.");
		put(team.colleague, MINE + "/" + id, better).expectStatus().isOk();
		String again = body(post(team.colleague, MINE + "/" + id + "/submit", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(again, "$.status")).isEqualTo("in_review");
		assertThat(JsonPath.<Object>read(again, "$.reviewNote")).isNull();
		assertThat(events(id)).containsExactly("use_case.submit", "use_case.send_back", "use_case.submit");
	}

	/** What the wizard sends: everything, with most of it empty. */
	private static Map<String, Object> save(long version) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("title", null);
		body.put("problemStatement", null);
		body.put("industry", null);
		body.put("technologies", List.of());
		body.put("expectedOutcomes", null);
		body.put("currentProcess", null);
		body.put("currentSolutions", null);
		body.put("targetUsers", null);
		body.put("requirements", List.of());
		body.put("dataReadiness", null);
		body.put("integrationRequirements", null);
		body.put("attachmentFileIds", List.of());
		body.put("budgetMin", null);
		body.put("budgetMax", null);
		body.put("budgetToBeDetermined", false);
		body.put("budgetMembersOnly", false);
		body.put("timelineMinWeeks", null);
		body.put("timelineMaxWeeks", null);
		body.put("closesAt", null);
		body.put("hideOrganizationName", false);
		body.put("version", version);
		return body;
	}

	/** Everything a use case needs to be sent for review. */
	private static Map<String, Object> complete(long version) {
		Map<String, Object> body = save(version);
		body.put("title", "AI vehicle ownership and document assistant");
		body.put("problemStatement", "Our service team checks vehicle documents by hand.");
		body.put("industry", "automotive_mobility");
		body.put("technologies", List.of("document_intelligence"));
		body.put("expectedOutcomes", "Cut hotline calls by 40%.");
		body.put("currentProcess", "Agents type dates into a spreadsheet.");
		body.put("targetUsers", "Vehicle owners and the service team.");
		body.put("requirements", List.of(Map.of("statement", "Read documents", "necessity", "required")));
		body.put("dataReadiness", "Scanned documents with labelled fields.");
		body.put("integrationRequirements", "App SDK and the document store API.");
		body.put("budgetMin", 15000);
		body.put("budgetMax", 40000);
		body.put("timelineMinWeeks", 8);
		body.put("timelineMaxWeeks", 12);
		body.put("closesAt", Instant.now().plus(60, ChronoUnit.DAYS).toString());
		return body;
	}

	/** An approved or pending organization with a founder, and a colleague the founder invites. */
	private Team team(String domain, boolean approved) {
		String founder = TestSignIn.session(client, mail, "founder@" + domain);
		UUID organization = UUID.fromString(JsonPath.read(body(post(founder, ORGANIZATION + "/organizations",
				Map.of("name", "Team " + domain, "type", "company", "country", "VN", "teamSize", "2_9", "industries",
						List.of("insurance"), "website", "https://example.test", "description",
						"Assistants for insurers.", "foundedYear", 2021, "jobTitle", "Founder"))
			.expectStatus()
			.isCreated()), "$.id"));
		String colleague = TestSignIn.session(client, mail, "colleague@" + domain);
		if (approved) {
			post(operator, ORGANIZATION + "/admin/organizations/" + organization + "/approve", Map.of()).expectStatus()
				.isNoContent();
			post(founder, ORGANIZATION + "/mine/invitations", Map.of("email", "colleague@" + domain, "role", "member"))
				.expectStatus()
				.isNoContent();
			String invitation = JsonPath.read(body(get(colleague, ORGANIZATION + "/mine").expectStatus().isOk()),
					"$.invitations[0].id");
			post(colleague, ORGANIZATION + "/invitations/" + invitation + "/accept", null).expectStatus().isNoContent();
		}
		return new Team(organization, founder, colleague);
	}

	private record Team(UUID organization, String founder, String colleague) {
	}

	private UUID create(String session) {
		return UUID.fromString(JsonPath.read(body(post(session, MINE, null).expectStatus().isCreated()), "$.id"));
	}

	/** A use case an operator published for the organization, which its members then find in their tab. */
	private UUID adminPublished(UUID organization, String title) {
		Map<String, Object> body = complete(0);
		body.remove("version");
		body.put("organizationId", organization);
		body.put("title", title);
		body.put("publishNow", true);
		body.put("closesAt", Instant.now().plus(60, ChronoUnit.DAYS).toString());
		return UUID.fromString(JsonPath.read(
				body(post(operator, "/api/usecase/admin/use-cases", body).expectStatus().isCreated()), "$.id"));
	}

	private List<String> events(UUID useCase) {
		return jdbc.sql("""
				select action from audit_event where resource_type = 'use_case' and resource_id = ?
				  and action <> 'use_case.create'
				order by occurred_at, id
				""").param(useCase.toString()).query(String.class).list();
	}

	private RestTestClient.ResponseSpec post(String session, String uri, Map<String, Object> body) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri(uri)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session);
		return body == null ? request.exchange() : request.contentType(MediaType.APPLICATION_JSON).body(body).exchange();
	}

	private RestTestClient.ResponseSpec put(String session, String uri, Map<String, Object> body) {
		return client.put()
			.uri(uri)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(body)
			.exchange();
	}

	private RestTestClient.ResponseSpec get(String session, String uri) {
		return client.get().uri(uri).cookie(TestSignIn.SESSION_COOKIE, session).exchange();
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

	@TestConfiguration(proxyBeanMethods = false)
	static class Mail {

		@Bean
		RecordingMailSender recordingMailSender() {
			return new RecordingMailSender();
		}

	}

}
