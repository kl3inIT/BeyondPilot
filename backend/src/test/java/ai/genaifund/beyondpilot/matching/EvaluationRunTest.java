package ai.genaifund.beyondpilot.matching;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import ai.genaifund.beyondpilot.matching.persistence.EvaluationRepository;
import com.jayway.jsonpath.JsonPath;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * How a program's evaluation runs are queued and taken (BEY-234), against PostgreSQL, with the program, the
 * organization and the use case made the way people make them. A change to a use case of the program queues one run
 * once the program has stayed unchanged for the settle minutes, and a second change moves it. The worker never wakes
 * by itself here: the test takes each run.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "beyondpilot.identity.operator-emails=operator@evaluation.test",
				"beyondpilot.matching.interval=PT24H" })
@Import({ TestcontainersConfiguration.class, EvaluationRunTest.Mail.class })
class EvaluationRunTest {

	private static final Duration WAIT = Duration.ofSeconds(10);

	private static final String AI = "/api/ai/admin/chat";

	/** A key made for this run, so that no key is written in the repository. */
	@DynamicPropertySource
	static void encryptionKey(DynamicPropertyRegistry registry) {
		byte[] key = new byte[32];
		new SecureRandom().nextBytes(key);
		registry.add("beyondpilot.ai.encryption-key", () -> Base64.getEncoder().encodeToString(key));
	}

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private EvaluationRuns runs;

	@Autowired
	private EvaluationRepository evaluations;

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		jdbc.sql("delete from evaluation_assessment").update();
		jdbc.sql("delete from evaluation_run").update();
		jdbc.sql("update ai_task_model set model_id = null, reasoning_effort = null, version = 0").update();
		jdbc.sql("delete from ai_provider where purpose = 'chat'").update();
		jdbc.sql("""
				update matching_settings set settle_minutes = 30, edit_runs_per_day = 3, member_runs_per_day = 2,
				    runs_per_day = 200, candidates = 40, parallel = 4, version = 0
				""").update();
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
		operator = TestSignIn.session(client, mail, "operator@evaluation.test");
	}

	@Test
	void aChangeToAUseCaseOfTheProgramQueuesOneRunAfterTheSettleTimeAndASecondChangeMovesIt() {
		String word = "ev" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
		evaluationOn();
		UUID program = program(word);
		UUID other = program(word + "-other");
		String buyer = TestSignIn.session(client, mail, "buyer-" + word + "@evaluation.test");
		UUID insurer = organization(buyer, "Lotus Insurance " + word);

		Instant before = Instant.now();
		UUID useCase = UUID.fromString(JsonPath.read(send("POST", "/api/usecase/admin/use-cases",
				useCase("Claims triage " + word, insurer, List.of(program))), "$.id"));
		await().atMost(WAIT).until(() -> runsOf(program).equals(List.of("queued change")));
		Instant first = notBefore(program);
		assertThat(first).isAfter(before.plus(Duration.ofMinutes(29)));
		assertThat(runsOf(other)).as("a program without the use case").isEmpty();

		// The use case is filed again: the run that waits starts later, and no second run is queued.
		send("PUT", "/api/usecase/admin/use-cases/" + useCase + "/programs", Map.of("programIds", List.of(program)));
		await().atMost(WAIT).until(() -> notBefore(program).isAfter(first));
		assertThat(runsOf(program)).containsExactly("queued change");

		// The board is the operators' own: the insurer's member is refused, the operator reads the run that waits.
		String board = "/api/matching/admin/programs/" + program + "/evaluations";
		client.get().uri(board).cookie(TestSignIn.SESSION_COOKIE, buyer).exchange().expectStatus().isForbidden();
		String read = send("GET", board, null);
		assertThat(JsonPath.<Boolean>read(read, "$.modelChosen")).isTrue();
		assertThat(JsonPath.<List<String>>read(read, "$.useCases[*].title")).containsExactly("Claims triage " + word);
		assertThat(JsonPath.<String>read(read, "$.run.state")).isEqualTo("queued");
		assertThat(JsonPath.<List<Object>>read(read, "$.candidates")).isEmpty();
		// Started by hand, the run that waits for its moment starts now; nothing else is queued.
		send("POST", board + "/runs", Map.of("assessAll", true));
		assertThat(jdbc.sql("select (not_before is null) || ' ' || assess_all from evaluation_run where program_id = ?")
			.param(program)
			.query(String.class)
			.single()).isEqualTo("true true");
		assertThat(jdbc.sql("select count(*) from audit_event where action = 'matching.evaluation_start'"
				+ " and resource_id = ?").param(program.toString()).query(Long.class).single()).isEqualTo(1);

		// Its time comes: the program has no submission yet, so the run ends with nothing to assess and asks nothing.
		jdbc.sql("update evaluation_run set not_before = now() - interval '1 second' where program_id = ?")
			.param(program)
			.update();
		runs.work();
		assertThat(runsOf(program)).containsExactly("done change");
		assertThat(jdbc.sql("""
				select s.name || ' ' || s.taken_in || ' ' || s.given_out || ' ' || s.calls from evaluation_run_step s
				join evaluation_run r on r.id = s.run_id where r.program_id = ? order by s.position
				""").param(program).query(String.class).list())
			.containsExactly("candidates 1 0 0", "assessment 0 0 0");
		assertThat(evaluations.lastRun(program).orElseThrow().total()).isZero();

		// An operator's run of a program whose use case was taken off it fails, and says why.
		send("PUT", "/api/usecase/admin/use-cases/" + useCase + "/programs", Map.of("programIds", List.of()));
		evaluations.queue(program, EvaluationRepository.BY_OPERATOR, null, EvaluationPrompts.VERSION, null, false)
			.orElseThrow();
		runs.work();
		assertThat(jdbc.sql("""
				select state || ' ' || failure from evaluation_run where program_id = ? order by created_at desc limit 1
				""").param(program).query(String.class).single()).isEqualTo("failed " + EvaluationRuns.NO_USE_CASE);

		// A change to a program with no use case queues nothing, and an operator is told to attach one.
		runs.changed(other);
		assertThat(runsOf(other)).isEmpty();
		assertThat(JsonPath.<String>read(body(client.post()
			.uri("/api/matching/admin/programs/" + other + "/evaluations/runs")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("assessAll", false))
			.exchange()
			.expectStatus()
			.isEqualTo(409)), "$.code")).isEqualTo("MATCHING_EVALUATION_NO_USE_CASE");
	}

	@Test
	void nothingIsQueuedWhileNoModelIsChosenForEvaluation() {
		String word = "nm" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
		UUID program = program(word);
		String buyer = TestSignIn.session(client, mail, "buyer-" + word + "@evaluation.test");
		UUID insurer = organization(buyer, "Lotus Insurance " + word);
		send("POST", "/api/usecase/admin/use-cases", useCase("Claims triage " + word, insurer, List.of(program)));

		runs.changed(program);
		assertThat(runsOf(program)).isEmpty();
	}

	private List<String> runsOf(UUID program) {
		return jdbc.sql("select state || ' ' || origin from evaluation_run where program_id = ? order by created_at, id")
			.param(program)
			.query(String.class)
			.list();
	}

	private Instant notBefore(UUID program) {
		return jdbc.sql("select not_before from evaluation_run where program_id = ? and state = 'queued'")
			.param(program)
			.query(Timestamp.class)
			.single()
			.toInstant();
	}

	/** A provider and a model chosen for evaluation; no call reaches it in these tests. */
	private void evaluationOn() {
		Map<String, Object> connection = new HashMap<>();
		connection.put("name", "Gateway");
		connection.put("adapterType", "openai");
		connection.put("baseUrl", "http://127.0.0.1:9/v1");
		connection.put("enabled", true);
		connection.put("key", "replace");
		connection.put("apiKey", "sk-test-evaluation");
		connection.put("version", 0);
		String id = JsonPath.read(send("POST", AI + "/providers", connection), "$.providers[0].id");
		Map<String, Object> model = new HashMap<>();
		model.put("modelName", "gpt-5-mini");
		model.put("displayName", null);
		model.put("contextWindow", 272000);
		model.put("maxOutputTokens", 128000);
		model.put("toolCalling", true);
		model.put("vision", false);
		model.put("reasoning", true);
		model.put("inputPrice", 0.25);
		model.put("outputPrice", 2);
		model.put("cachedInputPrice", null);
		model.put("version", 0);
		String added = send("POST", AI + "/providers/" + id + "/models", Map.of("models", List.of(model)));
		Map<String, Object> task = new HashMap<>();
		task.put("modelId", JsonPath.<String>read(added, "$.providers[0].models[0].id"));
		task.put("reasoningEffort", "medium");
		task.put("version", 0);
		send("PUT", AI + "/tasks/evaluation", task);
	}

	private UUID program(String slug) {
		return UUID.fromString(JsonPath.read(send("POST", "/api/program/admin/programs",
				Map.of("name", "Challenge " + slug, "slug", slug, "type", "enterprise_challenge")), "$.id"));
	}

	private UUID organization(String session, String name) {
		Map<String, Object> request = new HashMap<>(Map.of("name", name, "type", "company", "country", "VN", "teamSize",
				"2_9", "industries", List.of("insurance"), "website", "https://example.test", "description",
				"An insurer.", "foundedYear", 2021, "jobTitle", "Founder"));
		return UUID.fromString(JsonPath.read(body(client.post()
			.uri("/api/organization/organizations")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.exchange()
			.expectStatus()
			.isCreated()), "$.id"));
	}

	private static Map<String, Object> useCase(String title, UUID organization, List<UUID> programs) {
		Map<String, Object> request = new HashMap<>();
		request.put("organizationId", organization);
		request.put("title", title);
		request.put("problemStatement", "Claims wait days for a first look.");
		request.put("industry", "insurance");
		request.put("technologies", List.of("generative_ai"));
		request.put("expectedOutcomes", "A first assessment within an hour.");
		request.put("currentProcess", "Adjusters read every file.");
		request.put("currentSolutions", null);
		request.put("targetUsers", "Claims adjusters");
		request.put("requirements", List.of(Map.of("statement", "Reads Vietnamese forms", "necessity", "required")));
		request.put("dataReadiness", "Five years of claim files.");
		request.put("integrationRequirements", "Our claims system's API.");
		request.put("attachmentFileIds", List.of());
		request.put("budgetMin", 10000);
		request.put("budgetMax", 50000);
		request.put("budgetToBeDetermined", false);
		request.put("budgetMembersOnly", false);
		request.put("timelineMinWeeks", 4);
		request.put("timelineMaxWeeks", 12);
		request.put("closesAt", Instant.now().plus(Duration.ofDays(30)).toString());
		request.put("hideOrganizationName", true);
		request.put("publishNow", true);
		request.put("programIds", programs);
		return request;
	}

	/** Sends a request as the operator and answers the body of its success. */
	private String send(String method, String path, @Nullable Object body) {
		RestTestClient.RequestBodySpec request = client.method(HttpMethod.valueOf(method))
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator);
		return body((body == null ? request : request.contentType(MediaType.APPLICATION_JSON).body(body)).exchange()
			.expectStatus()
			.is2xxSuccessful());
	}

	private static String body(RestTestClient.ResponseSpec response) {
		byte[] bytes = response.expectBody().returnResult().getResponseBody();
		return bytes == null ? "" : new String(bytes, UTF_8);
	}

	/** The test mailbox, imported through a class of this test's own so that the test keeps a context of its own. */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

}
