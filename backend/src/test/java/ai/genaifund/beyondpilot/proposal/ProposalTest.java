package ai.genaifund.beyondpilot.proposal;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
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
 * Applying to a program over real HTTP against PostgreSQL: a draft saved step by step, a submission with its version
 * and its email, a change submitted again, withdrawing, and what is refused. Only the SMTP server is replaced.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@proposal.test")
@Import({ TestcontainersConfiguration.class, ProposalTest.Mail.class })
class ProposalTest {

	private static final String PROGRAMS = "/api/program/admin/programs";

	private static final String API = "/api/proposal";

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
		operator = TestSignIn.session(client, mail, "operator@proposal.test");
	}

	@Test
	void anIndividualAppliesChangesItSubmitsAgainAndWithdraws() {
		Form form = program("claims-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String email = "dat@individual.test";
		String applicant = TestSignIn.session(client, mail, email);

		String empty = body(get(applicant, form.path()).expectStatus().isOk());
		assertThat(JsonPath.<Object>read(empty, "$.application")).isNull();
		assertThat(JsonPath.<Object>read(empty, "$.organization")).isNull();
		assertThat(JsonPath.<Boolean>read(empty, "$.program.open")).isTrue();
		assertThat(JsonPath.<List<String>>read(empty, "$.program.questions[*].kind")).containsExactly("long_text",
				"single_choice", "file", "confirm");

		// A draft keeps what the form holds, whatever is missing.
		String draft = body(put(applicant, form.path(), application(Map.of("firstName", "Dat"), null, Map.of(), null))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(draft, "$.application.status")).isEqualTo("draft");
		String id = JsonPath.read(draft, "$.application.id");
		assertProblem(post(applicant, API + "/applications/" + id + "/submit", null), 400,
				"PROPOSAL_ORGANIZATION_REQUIRED");

		// On their own, a person applies through an organization made from their name, which waits for review.
		String organized = body(post(applicant, form.path() + "/organization",
				Map.of("kind", "individual", "name", "Dat Phan", "country", "VN"))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(organized, "$.organization.name")).isEqualTo("Dat Phan");
		assertThat(JsonPath.<String>read(organized, "$.organization.type")).isEqualTo("independent_builder");
		assertThat(JsonPath.<Boolean>read(organized, "$.organization.approved")).isFalse();
		UUID solution = completeSolution(applicant, email, "Claim Copilot");

		String saved = body(put(applicant, form.path(),
				application(contact(), solution, answers(form, email), versionOf(organized)))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<Integer>read(saved, "$.application.files.length()")).isEqualTo(1);
		String submitted = body(post(applicant, API + "/applications/" + id + "/submit", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(submitted, "$.application.status")).isEqualTo("submitted");
		assertThat(JsonPath.<Integer>read(submitted, "$.application.submissions")).isEqualTo(1);
		assertThat(mail.latestSubjectTo(email)).isEqualTo("Application submitted: Claims challenge");
		assertThat(snapshotName(id, 1)).isEqualTo("Dat Phan");

		// It can change until the close; each submission is a version, and the earlier one stays as it was.
		Map<String, String> changed = answers(form, email);
		changed.put(form.direction().toString(), "Carrying");
		put(applicant, form.path(), application(contact(), solution, changed, versionOf(submitted))).expectStatus()
			.isOk();
		String again = body(post(applicant, API + "/applications/" + id + "/submit", null).expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(again, "$.application.submissions")).isEqualTo(2);
		assertThat(answerOf(id, 1, form.direction())).isEqualTo("Claiming");
		assertThat(answerOf(id, 2, form.direction())).isEqualTo("Carrying");

		String withdrawn = body(post(applicant, API + "/applications/" + id + "/withdraw", null).expectStatus().isOk());
		assertThat(JsonPath.<String>read(withdrawn, "$.application.status")).isEqualTo("withdrawn");
		String mine = body(get(applicant, API + "/applications").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(mine, "$.items[*].programName")).containsExactly("Claims challenge");
		assertThat(JsonPath.<List<String>>read(mine, "$.items[*].status")).containsExactly("withdrawn");
		assertThat(JsonPath.<List<String>>read(mine, "$.items[*].solutionName")).containsExactly("Claim Copilot");
		assertProblem(get(TestSignIn.session(client, mail, "other@individual.test"), API + "/applications/" + id), 404,
				"PROPOSAL_APPLICATION_NOT_FOUND");
	}

	@Test
	void aSubmissionNeedsEverythingTheProgramAsks() {
		Form form = program("needs-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String email = "team@needs.test";
		String applicant = TestSignIn.session(client, mail, email);
		String organized = body(post(applicant, form.path() + "/organization",
				Map.of("kind", "team", "name", "Pocket Policy", "country", "VN", "teamSize", "2_9"))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(organized, "$.organization.type")).isEqualTo("builder_team");
		UUID solution = completeSolution(applicant, email, "Policy Chat");

		Map<String, String> answers = answers(form, email);
		answers.remove(form.confirmation().toString());
		String draft = body(put(applicant, form.path(), application(contact(), solution, answers, null)).expectStatus()
			.isOk());
		String id = JsonPath.read(draft, "$.application.id");
		String submit = API + "/applications/" + id + "/submit";
		assertProblem(post(applicant, submit, null), 400, "PROPOSAL_TEAM_BACKGROUND_REQUIRED");

		Map<String, Object> withBackground = application(contact(), solution, answers, versionOf(draft));
		withBackground.put("teamBackground", "Two engineers from an insurer.");
		String saved = body(put(applicant, form.path(), withBackground).expectStatus().isOk());
		assertProblem(post(applicant, submit, null), 400, "PROPOSAL_ANSWER_REQUIRED");

		Map<String, String> wrongChoice = answers(form, email);
		wrongChoice.put(form.direction().toString(), "Somewhere else");
		assertProblem(put(applicant, form.path(), application(contact(), solution, wrongChoice, versionOf(saved))), 400,
				"PROPOSAL_ANSWER_INVALID");
		Map<String, String> borrowedFile = answers(form, email);
		borrowedFile.put(form.proposalFile().toString(), file("operator@proposal.test").toString());
		assertProblem(put(applicant, form.path(), application(contact(), solution, borrowedFile, versionOf(saved))), 404,
				"STORAGE_FILE_NOT_FOUND");

		Map<String, Object> noPhone = application(Map.of("firstName", "Dat", "lastName", "Phan"), solution,
				answers(form, email), versionOf(saved));
		noPhone.put("teamBackground", "Two engineers from an insurer.");
		String partial = body(put(applicant, form.path(), noPhone).expectStatus().isOk());
		assertProblem(post(applicant, submit, null), 400, "PROPOSAL_CONTACT_INCOMPLETE");

		String bare = body(post(applicant, "/api/solution/mine", Map.of("name", "Bare Desk")).expectStatus()
			.isCreated());
		Map<String, Object> bareSolution = application(contact(), UUID.fromString(JsonPath.read(bare, "$.id")),
				answers(form, email), versionOf(partial));
		bareSolution.put("teamBackground", "Two engineers from an insurer.");
		put(applicant, form.path(), bareSolution).expectStatus().isOk();
		assertProblem(post(applicant, submit, null), 400, "PROPOSAL_SOLUTION_INCOMPLETE");
	}

	@Test
	void nothingIsSavedOutsideTheWindowAndASubmissionIsFinalWhereTheProgramSaysSo() {
		Form closed = program("closed-challenge", true, Instant.now().minus(Duration.ofMinutes(1)));
		String applicant = TestSignIn.session(client, mail, "late@window.test");
		assertThat(JsonPath.<Boolean>read(body(get(applicant, closed.path()).expectStatus().isOk()), "$.program.open"))
			.isFalse();
		assertProblem(put(applicant, closed.path(), application(Map.of(), null, Map.of(), null)), 409,
				"PROPOSAL_CLOSED");
		assertProblem(get(applicant, API + "/programs/no-such-program/application"), 409, "PROPOSAL_NOT_OPEN");

		Form fixed = program("final-challenge", false, Instant.now().plus(Duration.ofDays(10)));
		String email = "final@window.test";
		String early = TestSignIn.session(client, mail, email);
		post(early, fixed.path() + "/organization", Map.of("kind", "individual", "name", "Final Builder", "country",
				"SG"))
			.expectStatus()
			.isOk();
		UUID solution = completeSolution(early, email, "Final Desk");
		String draft = body(put(early, fixed.path(), application(contact(), solution, answers(fixed, email), null))
			.expectStatus()
			.isOk());
		String submitted = body(post(early, API + "/applications/" + JsonPath.read(draft, "$.application.id")
				+ "/submit", null)
			.expectStatus()
			.isOk());
		assertProblem(put(early, fixed.path(), application(contact(), solution, answers(fixed, email),
				versionOf(submitted))), 409, "PROPOSAL_LOCKED");
	}

	@Test
	void oneOrganizationAppliesOnceToAProgram() {
		Form form = program("company-challenge", true, Instant.now().plus(Duration.ofDays(10)));
		String founderEmail = "founder@company.test";
		String founder = TestSignIn.session(client, mail, founderEmail);
		String company = body(post(founder, "/api/organization/organizations",
				Map.of("name", "Company Co", "roles", List.of("provider"), "type", "company", "country", "VN",
						"teamSize", "10_49", "industries", List.of("insurance")))
			.expectStatus()
			.isCreated());
		String organizationId = JsonPath.read(company, "$.id");
		post(operator, "/api/organization/admin/organizations/" + organizationId + "/approve", null).expectStatus()
			.isNoContent();
		UUID solution = completeSolution(founder, founderEmail, "Company Desk");
		submitted(founder, founderEmail, form, solution);

		String colleagueEmail = "colleague@company.test";
		String colleague = TestSignIn.session(client, mail, colleagueEmail);
		post(colleague, "/api/organization/organizations/" + organizationId + "/join", Map.of()).expectStatus().isOk();
		Map<String, Object> second = application(contact(), solution, answers(form, colleagueEmail), null);
		second.put("teamBackground", "The same company.");
		String draft = body(put(colleague, form.path(), second).expectStatus().isOk());
		assertProblem(post(colleague, API + "/applications/" + JsonPath.read(draft, "$.application.id") + "/submit",
				null), 409, "PROPOSAL_ORGANIZATION_APPLIED");
	}

	/** A published program whose questions were set before its applications opened. */
	private Form program(String slug, boolean allowUpdates, Instant closesAt) {
		String created = body(post(operator, PROGRAMS,
				Map.of("name", slug.substring(0, 1).toUpperCase() + slug.substring(1).replace('-', ' '), "slug", slug,
						"type", "enterprise_challenge"))
			.expectStatus()
			.isCreated());
		String uri = PROGRAMS + "/" + JsonPath.read(created, "$.id");
		String asked = body(put(operator, uri + "/questions", Map.of("version", 0, "questions",
				List.of(question("long_text", "How does your solution address the challenge?", List.of()),
						question("single_choice", "Direction", List.of("Buying", "Carrying", "Claiming")),
						question("file", "Your proposal", List.of()),
						question("confirm", "I've read the one hard constraint.", List.of()))))
			.expectStatus()
			.isOk());
		List<String> ids = JsonPath.read(asked, "$.questions[*].id");
		Map<String, Object> program = new LinkedHashMap<>();
		program.put("version", JsonPath.<Integer>read(asked, "$.version"));
		program.put("name", JsonPath.read(created, "$.name"));
		program.put("slug", slug);
		program.put("type", "enterprise_challenge");
		program.put("pageKind", "standard");
		program.put("summary", "Insurers name what they need; providers answer.");
		program.put("coverFileId", image());
		program.put("startsOn", "2026-01-01");
		program.put("endsOn", "2099-12-31");
		Map<String, Object> applications = new LinkedHashMap<>();
		applications.put("opensAt", "2026-01-01T00:00:00Z");
		applications.put("closesAt", closesAt.toString());
		applications.put("allowUpdatesUntilClose", allowUpdates);
		program.put("applications", applications);
		program.put("keyDates", new ArrayList<>());
		program.put("events", new ArrayList<>());
		put(operator, uri, program).expectStatus().isOk();
		post(operator, uri + "/publish", null).expectStatus().isNoContent();
		return new Form(API + "/programs/" + slug + "/application", UUID.fromString(ids.get(0)),
				UUID.fromString(ids.get(1)), UUID.fromString(ids.get(2)), UUID.fromString(ids.get(3)));
	}

	/** A solution of the caller's organization with everything an application needs. */
	private UUID completeSolution(String session, String email, String name) {
		String draft = body(post(session, "/api/solution/mine", Map.of("name", name)).expectStatus().isCreated());
		Map<String, Object> solution = new HashMap<>();
		solution.put("name", name);
		solution.put("summary", "Tells a driver what is covered.");
		solution.put("problemsSolved", "Drivers wait on a hotline.");
		solution.put("focusAreas", List.of());
		solution.put("industries", List.of());
		solution.put("deployment", List.of());
		solution.put("maturity", "pilot");
		solution.put("deckFileId", file(email).toString());
		solution.put("listed", true);
		solution.put("version", JsonPath.<Integer>read(draft, "$.version"));
		String id = JsonPath.read(draft, "$.id");
		put(session, "/api/solution/mine/" + id, solution).expectStatus().isOk();
		return UUID.fromString(id);
	}

	private void submitted(String session, String email, Form form, UUID solution) {
		Map<String, Object> request = application(contact(), solution, answers(form, email), null);
		request.put("teamBackground", "Claims tooling at an insurer.");
		String draft = body(put(session, form.path(), request).expectStatus().isOk());
		post(session, API + "/applications/" + JsonPath.read(draft, "$.application.id") + "/submit", null)
			.expectStatus()
			.isOk();
	}

	private Map<String, String> answers(Form form, String uploader) {
		Map<String, String> answers = new HashMap<>();
		answers.put(form.approach().toString(), "Claims reach a decision without a hotline call.");
		answers.put(form.direction().toString(), "Claiming");
		answers.put(form.proposalFile().toString(), file(uploader).toString());
		answers.put(form.confirmation().toString(), "true");
		return answers;
	}

	private static Map<String, Object> application(Map<String, String> contact, UUID solutionId,
			Map<String, String> answers, Object version) {
		Map<String, Object> application = new HashMap<>();
		application.put("contact", contact);
		application.put("solutionId", solutionId == null ? null : solutionId.toString());
		application.put("answers", answers);
		application.put("version", version);
		return application;
	}

	private static Map<String, String> contact() {
		return Map.of("firstName", "Dat", "lastName", "Phan", "phone", "+84 912 345 678", "country", "VN", "linkedin",
				"https://www.linkedin.com/in/datphan");
	}

	private static Map<String, Object> question(String kind, String label, List<String> options) {
		Map<String, Object> question = new LinkedHashMap<>();
		question.put("kind", kind);
		question.put("label", label);
		question.put("required", true);
		question.put("options", options);
		return question;
	}

	private static long versionOf(String view) {
		Number version = JsonPath.read(view, "$.application.version");
		return version.longValue();
	}

	private String snapshotName(String proposal, int number) {
		return jdbc.sql("select snapshot -> 'organization' ->> 'name' from proposal_version where proposal_id = ? and number = ?")
			.params(UUID.fromString(proposal), number)
			.query(String.class)
			.single();
	}

	private String answerOf(String proposal, int number, UUID question) {
		return jdbc.sql("""
				select answer ->> 'value' from proposal_version, jsonb_array_elements(snapshot -> 'answers') answer
				where proposal_id = ? and number = ? and answer ->> 'questionId' = ?
				""").params(UUID.fromString(proposal), number, question.toString()).query(String.class).single();
	}

	/** The record of a stored PDF an applicant uploaded; a save reads the record, never the bytes. */
	private UUID file(String uploader) {
		UUID id = UUID.randomUUID();
		jdbc.sql("""
				insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type,
				                          size_bytes, status, uploaded_by_account_id, upload_expires_at)
				select ?, 'local', ?, 'application_file', false, 'proposal.pdf', 'application/pdf', 2048, 'stored', id, now()
				from identity_account where email = ?
				""").params(id, "test/" + id, uploader).update();
		return id;
	}

	private UUID image() {
		UUID id = UUID.randomUUID();
		jdbc.sql("""
				insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type,
				                          size_bytes, status, uploaded_by_account_id, upload_expires_at)
				select ?, 'local', ?, 'program_image', true, 'cover.png', 'image/png', 2048, 'stored', id, now()
				from identity_account where email = 'operator@proposal.test'
				""").params(id, "test/" + id).update();
		return id;
	}

	private RestTestClient.ResponseSpec get(String session, String uri) {
		return client.get().uri(uri).cookie(TestSignIn.SESSION_COOKIE, session).exchange();
	}

	private RestTestClient.ResponseSpec post(String session, String uri, Object body) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri(uri)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session);
		return body == null ? request.exchange() : request.contentType(MediaType.APPLICATION_JSON).body(body).exchange();
	}

	private RestTestClient.ResponseSpec put(String session, String uri, Object body) {
		return client.put()
			.uri(uri)
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
			.isEqualTo(code);
	}

	/** A program's application form: where it is read and saved, and its four questions. */
	private record Form(String path, UUID approach, UUID direction, UUID proposalFile, UUID confirmation) {
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class Mail {

		@Bean
		RecordingMailSender recordingMailSender() {
			return new RecordingMailSender();
		}

	}

}
