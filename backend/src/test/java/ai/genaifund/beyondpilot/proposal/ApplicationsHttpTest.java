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
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * What the proposal tests share: the full application over real HTTP against PostgreSQL, an operator, programs with
 * questions, applicants with a complete solution, and the requests. Only the SMTP server is replaced.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@proposal.test")
@Import({ TestcontainersConfiguration.class, ApplicationsHttpTest.Mail.class })
abstract class ApplicationsHttpTest {

	static final String PROGRAMS = "/api/program/admin/programs";

	static final String API = "/api/proposal";

	@LocalServerPort
	private int port;

	@Autowired
	TestMailbox mail;

	@Autowired
	JdbcClient jdbc;

	RestTestClient client;

	String operator;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
		operator = TestSignIn.session(client, mail, "operator@proposal.test");
	}

	/** A published program whose questions were set before its applications opened. */
	Form program(String slug, boolean allowUpdates, Instant closesAt) {
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
		return new Form(UUID.fromString(JsonPath.read(created, "$.id")), API + "/programs/" + slug + "/application", UUID.fromString(ids.get(0)),
				UUID.fromString(ids.get(1)), UUID.fromString(ids.get(2)), UUID.fromString(ids.get(3)));
	}

	/** Moves a program's close into the past, as if its applications had closed a minute ago. */
	void close(Form form) {
		jdbc.sql("update program set applications_close_at = now() - interval '1 minute' where id = ?")
			.params(form.programId())
			.update();
	}

	/** The audit actions recorded about a program, the oldest first. */
	List<String> auditOf(UUID programId) {
		return jdbc.sql("select action from audit_event where resource_id = ? order by occurred_at, action")
			.params(programId.toString())
			.query(String.class)
			.list();
	}

		/** A solution of the caller's organization with everything an application needs. */
	UUID completeSolution(String session, String email, String name) {
		String draft = body(post(session, "/api/solution/mine", Map.of("name", name)).expectStatus().isCreated());
		Map<String, Object> solution = new HashMap<>();
		solution.put("name", name);
		solution.put("summary", "Tells a driver what is covered.");
		solution.put("problemsSolved", "Drivers wait on a hotline.");
		solution.put("focusAreas", List.of());
		solution.put("industries", List.of());
		solution.put("builtWith", List.of());
		solution.put("languages", List.of());
		solution.put("deployment", List.of());
		solution.put("maturity", "pilot");
		solution.put("listed", true);
		solution.put("version", JsonPath.<Integer>read(draft, "$.version"));
		String id = JsonPath.read(draft, "$.id");
		put(session, "/api/solution/mine/" + id, solution).expectStatus().isOk();
		return UUID.fromString(id);
	}

	void submitted(String session, String email, Form form, UUID solution) {
		Map<String, Object> request = withDeck(application(contact(), solution, answers(form, email), null), email);
		request.put("teamBackground", "Claims tooling at an insurer.");
		String draft = body(put(session, form.path(), request).expectStatus().isOk());
		post(session, API + "/applications/" + JsonPath.read(draft, "$.application.id") + "/submit", null)
			.expectStatus()
			.isOk();
	}

	Map<String, String> answers(Form form, String uploader) {
		Map<String, String> answers = new HashMap<>();
		answers.put(form.approach().toString(), "Claims reach a decision without a hotline call.");
		answers.put(form.direction().toString(), "Claiming");
		answers.put(form.proposalFile().toString(), file(uploader).toString());
		answers.put(form.confirmation().toString(), "true");
		return answers;
	}

	Map<String, Object> application(Map<String, String> contact, UUID solutionId,
			Map<String, String> answers, Object version) {
		Map<String, Object> application = new HashMap<>();
		application.put("contact", contact);
		application.put("solutionId", solutionId == null ? null : solutionId.toString());
		application.put("builtWith", List.of(" OpenAI GPT ", "Whisper"));
		application.put("traction", "Two pilots with insurers.");
		application.put("answers", answers);
		application.put("version", version);
		return application;
	}

	/** An application with its deck, a PDF the applicant uploaded. */
	Map<String, Object> withDeck(Map<String, Object> application, String uploader) {
		application.put("deckFileId", file(uploader).toString());
		return application;
	}

	static Map<String, String> contact() {
		return Map.of("firstName", "Dat", "lastName", "Phan", "phone", "+84 912 345 678", "country", "VN", "linkedin",
				"https://www.linkedin.com/in/datphan");
	}

	static Map<String, Object> question(String kind, String label, List<String> options) {
		Map<String, Object> question = new LinkedHashMap<>();
		question.put("kind", kind);
		question.put("label", label);
		question.put("required", true);
		question.put("options", options);
		return question;
	}

	static long versionOf(String view) {
		Number version = JsonPath.read(view, "$.application.version");
		return version.longValue();
	}

	String snapshotName(String proposal, int number) {
		return jdbc.sql("select snapshot -> 'organization' ->> 'name' from proposal_version where proposal_id = ? and number = ?")
			.params(UUID.fromString(proposal), number)
			.query(String.class)
			.single();
	}

	String answerOf(String proposal, int number, UUID question) {
		return jdbc.sql("""
				select answer ->> 'value' from proposal_version, jsonb_array_elements(snapshot -> 'answers') answer
				where proposal_id = ? and number = ? and answer ->> 'questionId' = ?
				""").params(UUID.fromString(proposal), number, question.toString()).query(String.class).single();
	}

	/** The record of a stored PDF an applicant uploaded; a save reads the record, never the bytes. */
	UUID file(String uploader) {
		UUID id = UUID.randomUUID();
		jdbc.sql("""
				insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type,
				                          size_bytes, status, uploaded_by_account_id, upload_expires_at)
				select ?, 'local', ?, 'application_file', false, 'proposal.pdf', 'application/pdf', 2048, 'stored', id, now()
				from identity_account where email = ?
				""").params(id, "test/" + id, uploader).update();
		return id;
	}

	UUID image() {
		UUID id = UUID.randomUUID();
		jdbc.sql("""
				insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type,
				                          size_bytes, status, uploaded_by_account_id, upload_expires_at)
				select ?, 'local', ?, 'program_image', true, 'cover.png', 'image/png', 2048, 'stored', id, now()
				from identity_account where email = 'operator@proposal.test'
				""").params(id, "test/" + id).update();
		return id;
	}

	RestTestClient.ResponseSpec get(String session, String uri) {
		return client.get().uri(uri).cookie(TestSignIn.SESSION_COOKIE, session).exchange();
	}

	RestTestClient.ResponseSpec post(String session, String uri, Object body) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri(uri)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session);
		return body == null ? request.exchange() : request.contentType(MediaType.APPLICATION_JSON).body(body).exchange();
	}

	RestTestClient.ResponseSpec put(String session, String uri, Object body) {
		return client.put()
			.uri(uri)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(body)
			.exchange();
	}

	RestTestClient.ResponseSpec delete(String session, String uri) {
		return client.delete()
			.uri(uri)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange();
	}

	static String body(RestTestClient.ResponseSpec response) {
		return new String(response.expectBody().returnResult().getResponseBody(), UTF_8);
	}

	static void assertProblem(RestTestClient.ResponseSpec response, int status, String code) {
		response.expectStatus()
			.isEqualTo(status)
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo(code);
	}

	/** A program's application form: where it is read and saved, and its four questions. */
	record Form(UUID programId, String path, UUID approach, UUID direction, UUID proposalFile, UUID confirmation) {
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
