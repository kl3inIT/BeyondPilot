package ai.genaifund.beyondpilot.program;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

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
 * What operators do with programs, over real HTTP against PostgreSQL: who may, what a draft holds, what is refused,
 * and what the audit trail keeps of it. Only the SMTP server is replaced.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@program.test")
@Import({ TestcontainersConfiguration.class, ProgramAdministrationTest.Mail.class })
class ProgramAdministrationTest {

	private static final String PROGRAMS = "/api/program/admin/programs";

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
		operator = TestSignIn.session(client, mail, "operator@program.test");
	}

	@Test
	void nobodyButAnOperatorReadsOrCreatesPrograms() {
		String user = TestSignIn.session(client, mail, "plain@program.test");
		String guarded = create(operator, "Guarded", "guarded", "event").expectStatus()
			.isCreated()
			.expectBody(String.class)
			.returnResult()
			.getResponseBody();
		String one = PROGRAMS + "/" + JsonPath.<String>read(guarded, "$.id");

		client.get().uri(PROGRAMS).exchange().expectStatus().isUnauthorized();
		client.get().uri(one).exchange().expectStatus().isUnauthorized();
		create(null, "Nobody", "nobody", "event").expectStatus().isUnauthorized();

		assertProblem(get(user, PROGRAMS), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(get(user, one), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(create(user, "Mine", "mine", "event"), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertThat(slugs()).doesNotContain("nobody", "mine");
	}

	@Test
	void anOperatorCreatesADraftAndReadsItBack() {
		String body = new String(
				create(operator, "  AI for Insurance Challenge × Tasco ", "insurance-ai-tasco", "enterprise_challenge")
					.expectStatus()
					.isCreated()
					.expectBody()
					.jsonPath("$.name")
					.isEqualTo("AI for Insurance Challenge × Tasco")
					.jsonPath("$.slug")
					.isEqualTo("insurance-ai-tasco")
					.jsonPath("$.type")
					.isEqualTo("enterprise_challenge")
					.jsonPath("$.status")
					.isEqualTo("draft")
					.jsonPath("$.pageKind")
					.isEqualTo("standard")
					.jsonPath("$.version")
					.isEqualTo(0)
					.jsonPath("$.createdAt")
					.isNotEmpty()
					.returnResult()
					.getResponseBody(),
				UTF_8);
		String id = JsonPath.read(body, "$.id");

		get(operator, PROGRAMS + "/" + id).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.id")
			.isEqualTo(id)
			.jsonPath("$.summary")
			.isEmpty()
			.jsonPath("$.startsOn")
			.isEmpty();
		assertThat(slugs()).contains("insurance-ai-tasco");
		assertThat(eventsOf(id)).singleElement()
			.satisfies(event -> assertThat(event).containsEntry("action", "program.create")
				.containsEntry("actor_email", "operator@program.test")
				.containsEntry("resource_label", "AI for Insurance Challenge × Tasco"));
	}

	@Test
	void theListIsNewestFirst() {
		create(operator, "Earlier", "listed-earlier", "hackathon").expectStatus().isCreated();
		create(operator, "Later", "listed-later", "accelerator").expectStatus().isCreated();

		assertThat(slugs()).containsSubsequence("listed-later", "listed-earlier");
	}

	@Test
	void anAddressBelongsToOneProgram() {
		create(operator, "First", "taken-address", "event").expectStatus().isCreated();

		assertProblem(create(operator, "Second", "taken-address", "event"), 409, "PROGRAM_SLUG_TAKEN");

		assertThat(jdbc.sql("select name from program where slug = 'taken-address'").query(String.class).list())
			.containsExactly("First");
	}

	@Test
	void aRequestThatIsNotValidPointsAtItsMembers() {
		for (String slug : List.of("Upper-Case", "-leading", "double--hyphen", "ab", "has space", "x".repeat(61))) {
			String body = new String(create(operator, " ", slug, "summit").expectStatus()
				.isBadRequest()
				.expectHeader()
				.contentType(MediaType.APPLICATION_PROBLEM_JSON)
				.expectBody()
				.returnResult()
				.getResponseBody(), UTF_8);

			assertThat(JsonPath.<String>read(body, "$.code")).isEqualTo("REQUEST_INVALID");
			assertThat(JsonPath.<List<String>>read(body, "$.errors[*].pointer")).as(slug)
				.containsOnly("#/name", "#/slug", "#/type");
		}
	}

	@Test
	void aProgramThatDoesNotExistIsNotFound() {
		assertProblem(get(operator, PROGRAMS + "/00000000-0000-0000-0000-000000000000"), 404, "PROGRAM_NOT_FOUND");
	}

	private RestTestClient.ResponseSpec create(String session, String name, String slug, String type) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri(PROGRAMS)
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON);
		if (session != null) {
			request = request.cookie(TestSignIn.SESSION_COOKIE, session);
		}
		return request.body(Map.of("name", name, "slug", slug, "type", type)).exchange();
	}

	private RestTestClient.ResponseSpec get(String session, String uri) {
		return client.get().uri(uri).cookie(TestSignIn.SESSION_COOKIE, session).exchange();
	}

	private List<String> slugs() {
		String body = new String(get(operator, PROGRAMS).expectStatus().isOk().expectBody().returnResult().getResponseBody(),
				UTF_8);
		return JsonPath.read(body, "$.items[*].slug");
	}

	private List<Map<String, Object>> eventsOf(String program) {
		return jdbc.sql("""
				select action, actor_email, resource_label
				from audit_event where resource_type = 'program' and resource_id = ? order by occurred_at, id
				""").param(program).query().listOfRows();
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
