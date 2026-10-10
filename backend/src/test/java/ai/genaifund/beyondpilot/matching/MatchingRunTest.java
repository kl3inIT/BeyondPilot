package ai.genaifund.beyondpilot.matching;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Requirement;
import ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.Passage;
import ai.genaifund.beyondpilot.storage.TestUploads;
import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import reactor.core.Disposable;
import tools.jackson.databind.json.JsonMapper;

/**
 * A run of matching from a published use case to its judged candidates, against PostgreSQL, with the organization, the
 * solution and the use case made the way people make them. The model is played by the JDK's own HTTP server; no test
 * calls a real provider. The worker never wakes by itself here: the test takes each run.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "beyondpilot.identity.operator-emails=operator@matching.test",
				"beyondpilot.matching.interval=PT24H" })
@Import({ TestcontainersConfiguration.class, MatchingRunTest.Mail.class })
class MatchingRunTest {

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
	private JsonMapper json;

	@Autowired
	private MatchingRuns runs;

	@Autowired
	private MatchingChanges changes;

	@Autowired
	private MatchingRepository matching;

	@Autowired
	private SearchPassageRepository passages;

	private RestTestClient client;

	private String operator;

	private HttpServer provider;

	/** Which question each call to the model was: {@code requirements} or {@code judgment}. */
	private final List<String> asked = new CopyOnWriteArrayList<>();

	/** Whether the provider says its limit is reached. */
	private final AtomicBoolean refusing = new AtomicBoolean();

	/** How many judgments the provider holds unanswered now, and the most it held at the same time. */
	private final AtomicInteger answering = new AtomicInteger();

	private final AtomicInteger mostAtOnce = new AtomicInteger();

	/** When set, a judgment is answered only once as many as it counts are being asked at the same time. */
	private final AtomicReference<@Nullable CountDownLatch> together = new AtomicReference<>();

	@BeforeEach
	void setUp() throws IOException {
		jdbc.sql("delete from matching_candidate").update();
		jdbc.sql("delete from matching_run").update();
		jdbc.sql("delete from matching_requirement").update();
		jdbc.sql("update ai_task_model set model_id = null, reasoning_effort = null, version = 0").update();
		// A run starts as soon as the use case is published; the wait after a change has its own test.
		jdbc.sql("""
				update matching_settings set settle_minutes = 0, edit_runs_per_day = 3, member_runs_per_day = 2,
				    runs_per_day = 200, candidates = 40, parallel = 8, version = 0
				""").update();
		jdbc.sql("delete from ai_provider where purpose = 'chat'").update();
		jdbc.sql("delete from ai_usage").update();
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
		operator = TestSignIn.session(client, mail, "operator@matching.test");
		provider = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		provider.createContext("/v1/chat/completions", exchange -> {
			String sent = new String(exchange.getRequestBody().readAllBytes(), UTF_8);
			boolean requirements = sent.contains("use case brief and list");
			if (refusing.get()) {
				answer(exchange, 429, "{\"error\":{\"message\":\"limit reached\"}}");
				return;
			}
			asked.add(requirements ? "requirements" : "judgment");
			if (requirements) {
				answer(exchange, 200, completion(REQUIREMENTS));
				return;
			}
			mostAtOnce.accumulateAndGet(answering.incrementAndGet(), Math::max);
			CountDownLatch others = together.get();
			if (others != null) {
				others.countDown();
				awaitOthers(others);
			}
			// The call is counted out before its answer leaves, so the next one the run sends never meets it.
			answering.decrementAndGet();
			answer(exchange, 200, completion(JUDGMENT));
		});
		// The provider answers several calls at once, as a real one does.
		provider.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
		provider.start();
	}

	@AfterEach
	void stopProvider() {
		provider.stop(0);
	}

	/** What the model lists for the brief; the last item quotes words the brief does not hold. */
	private static final Map<String, Object> REQUIREMENTS = Map.of("requirements", List.of(
			Map.of("kind", "constraint", "necessity", "optional", "statement", "Integrates with the claims system.",
					"quote", "Our claims system's API."),
			Map.of("kind", "capability", "necessity", "required", "statement",
					"Reads printed and handwritten forms in Vietnamese.", "quote", "Reads Vietnamese forms", "label",
					"Read forms"),
			Map.of("kind", "capability", "necessity", "required", "statement", "Gives a first assessment of a claim.",
					"quote", "A first assessment within an hour."),
			Map.of("kind", "capability", "necessity", "optional", "statement", "Detects fraud.", "quote",
					"flags fraudulent claims before payment")));

	/** What the model finds for the candidate: two capabilities with real quotes, and one it made up. */
	private static final Map<String, Object> JUDGMENT = Map.of("findings",
			List.of(Map.of("requirementId", "R1", "quote", "reads Vietnamese claim forms", "source", "deck p.1", "status",
					"met"),
					Map.of("requirementId", "R2", "quote", "a first assessment of every claim", "source", "deck p.2",
							"status", "met"),
					Map.of("requirementId", "R3", "quote", "Connects to any claims system out of the box", "source",
							"deck p.2", "status", "met")),
			"industryFit", Map.of("quote", "Answers calls and chats for insurers.", "source", "profile", "status", "met"),
			"technologyFit", Map.of("quote", "", "source", "", "status", "not_shown"), "summary",
			"It reads Vietnamese claim forms and gives a first assessment.");

	@Test
	void aPublishedUseCaseIsMatchedOnceAndARunThatMeetsTheProvidersLimitWaitsAndGoesOn() throws Exception {
		String word = "zq" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
		matchingOn("http://127.0.0.1:" + provider.getAddress().getPort() + "/v1");
		String owner = TestSignIn.session(client, mail, "owner-" + word + "@matching.test");
		UUID vendor = organization(owner, "Claims Lab " + word);
		post(operator, "/api/organization/admin/organizations/" + vendor + "/approve", Map.of());
		String buyer = TestSignIn.session(client, mail, "buyer-" + word + "@matching.test");
		UUID bank = organization(buyer, "Lotus Bank " + word);
		post(operator, "/api/organization/admin/organizations/" + bank + "/approve", Map.of());
		UUID solution = submittedSolution(owner, "Claims Desk " + word);
		post(operator, "/api/solution/admin/solutions/" + solution + "/approve", null);
		await().atMost(WAIT)
			.until(() -> jdbc.sql("select count(*) from search_document where item_id = ?")
				.param(solution)
				.query(Long.class)
				.single() == 1);
		deck(solution, "Claims Desk reads Vietnamese claim forms, printed or handwritten.");

		// Publishing the use case queues its run; nobody starts it.
		UUID useCase = UUID.fromString(JsonPath.read(body(client.post()
			.uri("/api/usecase/admin/use-cases")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.contentType(MediaType.APPLICATION_JSON)
			.body(useCase("Claims triage " + word, bank))
			.exchange()
			.expectStatus()
			.is2xxSuccessful()), "$.id"));
		await().atMost(WAIT).until(() -> runsOf(useCase).equals(List.of("queued approved")));

		// A page open on the use case hears each thing the run does, and reads the stage the run is at when it hears it.
		String path = "/api/matching/use-cases/" + useCase;
		List<String> heard = new CopyOnWriteArrayList<>();
		Disposable listening = changes.of(useCase).subscribe(change -> {
			String state = body(call("GET", operator, path, null).expectStatus().isOk());
			heard.add(change.kind() + " " + JsonPath.<String>read(state, "$.run.state") + " "
					+ JsonPath.<Object>read(state, "$.run.stage")
					+ (change.solutionId() == null ? "" : solution.equals(change.solutionId()) ? " the solution" : " another"));
		});

		runs.work();

		listening.dispose();
		assertThat(heard).containsExactly("RUN running brief", "BRIEF running search", "FOUND running reading",
				"READING running reading the solution", "READ running reading the solution", "RUN done null");
		assertThat(runsOf(useCase)).containsExactly("done approved");
		// The requirement whose quote the brief does not hold is the model's own and is not kept; capabilities first.
		assertThat(matching.requirements(useCase)).extracting(Requirement::kind, Requirement::statement)
			.containsExactly(org.assertj.core.groups.Tuple.tuple("capability",
					"Reads printed and handwritten forms in Vietnamese."),
					org.assertj.core.groups.Tuple.tuple("capability", "Gives a first assessment of a claim."),
					org.assertj.core.groups.Tuple.tuple("constraint", "Integrates with the claims system."));
		// Both required capabilities stand on quotes that are in the deck; the invented one is lowered.
		assertThat(candidate(useCase, solution)).isEqualTo("direct 2/2 1 website met,met,not_shown exact,exact,not_found");
		assertThat(asked).containsExactly("requirements", "judgment");
		assertThat(steps(useCase)).containsExactly("requirements 1 3 1", "candidates 3 1 0", "judgment 1 1 1");
		assertThat(jdbc.sql("""
				select count(*) from ai_usage
				where task = 'matching' and subject_type = 'matching_run' and error_type is null
				""").query(Long.class).single()).isEqualTo(2);
		assertThat(jdbc.sql("select model_name from matching_run where use_case_id = ?")
			.param(useCase)
			.query(String.class)
			.single()).isEqualTo("gpt-5-mini");

		// A second run of the same brief and the same material asks the model nothing.
		matching.queue(useCase, MatchingRepository.BY_OPERATOR, null, Prompts.VERSION, null, false).orElseThrow();
		runs.work();
		assertThat(runsOf(useCase)).containsExactly("done approved", "done operator");
		assertThat(asked).hasSize(2);

		// The deck changes and the provider says its limit is reached: the run waits, and what was judged stays.
		deck(solution, "Claims Desk reads Vietnamese claim forms in seconds.");
		refusing.set(true);
		UUID third = matching.queue(useCase, MatchingRepository.BY_OPERATOR, null, Prompts.VERSION, null, false)
			.orElseThrow();
		runs.work();
		assertThat(jdbc.sql("select state || ' ' || stalls || ' ' || (failure is not null) from matching_run where id = ?")
			.param(third)
			.query(String.class)
			.single()).isEqualTo("waiting 1 true");
		assertThat(candidate(useCase, solution)).startsWith("direct 2/2");

		// Its wait is over and the provider answers again: only the changed candidate is judged, and the run ends.
		refusing.set(false);
		jdbc.sql("update matching_run set resume_at = now() - interval '1 second' where id = ?").param(third).update();
		runs.work();
		assertThat(runsOf(useCase)).containsExactly("done approved", "done operator", "done operator");
		assertThat(asked).containsExactly("requirements", "judgment", "judgment");

		// A member of the use case's organization reads the candidates with their reasons, and nothing of the cost.
		String read = body(call("GET", buyer, path, null).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(read, "$.operator")).isFalse();
		assertThat(JsonPath.<Integer>read(read, "$.runsLeftToday")).isEqualTo(2);
		assertThat(JsonPath.<String>read(read, "$.run.state")).isEqualTo("done");
		assertThat(JsonPath.<Object>read(read, "$.run.modelName")).isNull();
		assertThat(JsonPath.<List<Object>>read(read, "$.steps")).isEmpty();
		assertThat(JsonPath.<List<String>>read(read, "$.requirements[*].kind"))
			.containsExactly("capability", "capability", "constraint");
		// A requirement is named by its label in a list; one the model gave none has an empty one.
		assertThat(JsonPath.<List<String>>read(read, "$.requirements[*].label")).containsExactly("Read forms", "", "");
		assertThat(JsonPath.<String>read(read, "$.candidates[0].maturity")).isEqualTo("pilot");
		assertThat(JsonPath.<String>read(read, "$.candidates[0].country")).isEqualTo("VN");
		assertThat(JsonPath.<String>read(read, "$.candidates[0].logoFileId")).isNotBlank();
		assertThat(JsonPath.<List<String>>read(read, "$.candidates[*].solutionName")).containsExactly("Claims Desk " + word);
		assertThat(JsonPath.<String>read(read, "$.candidates[0].bucket")).isEqualTo("direct");
		assertThat(JsonPath.<String>read(read, "$.candidates[0].organizationName")).isEqualTo("Claims Lab " + word);
		assertThat(JsonPath.<String>read(read, "$.candidates[0].findings[0].quote")).isEqualTo("reads Vietnamese claim forms");
		assertThat(JsonPath.<String>read(read, "$.candidates[0].findings[0].source")).isEqualTo("deck p.1");
		assertThat(JsonPath.<String>read(read, "$.candidates[0].findings[2].status")).isEqualTo("not_shown");
		assertThat(JsonPath.<String>read(read, "$.candidates[0].industry.status")).isEqualTo("met");
		String candidate = JsonPath.read(read, "$.candidates[0].id");
		// The vendor's own member, and anyone else, is told there is no such use case.
		assertProblem(call("GET", owner, path, null), 404, "MATCHING_USE_CASE_NOT_FOUND");
		// So is whoever asks to hear its changes, in the words a browser asks with; and nobody hears without a session.
		assertProblem(client.get()
			.uri(path + "/events")
			.accept(MediaType.TEXT_EVENT_STREAM)
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.exchange(), 404, "MATCHING_USE_CASE_NOT_FOUND");
		client.get().uri(path + "/events").accept(MediaType.TEXT_EVENT_STREAM).exchange().expectStatus().isUnauthorized();
		// A candidate that is not theirs reads as one that does not exist, so no identifier can be probed.
		assertProblem(call("POST", owner, "/api/matching/candidates/" + candidate + "/shortlist", null), 404,
				"MATCHING_CANDIDATE_NOT_FOUND");
		assertProblem(call("POST", owner, "/api/matching/candidates/" + UUID.randomUUID() + "/shortlist", null), 404,
				"MATCHING_CANDIDATE_NOT_FOUND");
		// An operator sees how the run worked.
		String asOperator = body(call("GET", operator, path, null).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(asOperator, "$.steps[*].name"))
			.containsExactly("requirements", "candidates", "judgment");
		assertThat(JsonPath.<String>read(asOperator, "$.run.modelName")).isEqualTo("gpt-5-mini");
		assertThat(JsonPath.<Object>read(asOperator, "$.runsLeftToday")).isNull();

		// The member shortlists, removes with a reason and restores; a run never undoes it.
		String decide = "/api/matching/candidates/" + candidate;
		// The member's page keeps a stream open, as a browser does: it is told at once that it is open, in a response
		// no proxy may hold back, and then of the decision, once it is kept.
		try (HttpClient browser = HttpClient.newHttpClient()) {
			HttpResponse<InputStream> stream = browser.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path + "/events"))
				.header("Accept", MediaType.TEXT_EVENT_STREAM_VALUE)
				.header("Cookie", TestSignIn.SESSION_COOKIE + "=" + buyer)
				.build(), HttpResponse.BodyHandlers.ofInputStream());
			try (BufferedReader lines = new BufferedReader(new InputStreamReader(stream.body(), UTF_8))) {
				assertThat(stream.statusCode()).isEqualTo(200);
				assertThat(stream.headers().firstValue("Content-Type").orElseThrow()).startsWith(MediaType.TEXT_EVENT_STREAM_VALUE);
				assertThat(stream.headers().allValues("Cache-Control")).containsExactly("no-store");
				assertThat(stream.headers().firstValue("X-Accel-Buffering")).contains("no");
				assertThat(line(lines)).startsWith(":");
				assertThat(decision(call("POST", buyer, decide + "/shortlist", null))).isEqualTo("shortlisted");
				assertThat(event(lines)).isEqualTo("event:decision data:{}");
			}
			finally {
				// The stream has no end of its own; the client is closed without waiting for one.
				browser.shutdownNow();
			}
		}
		assertProblem(call("POST", buyer, decide + "/remove", Map.of("reason", "too_small")), 400, "REQUEST_INVALID");
		String removed = body(call("POST", buyer, decide + "/remove", Map.of("reason", "duplicate", "note", " Same as Claims Desk. "))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(removed, "$.candidates[0].decision")).isEqualTo("removed");
		assertThat(JsonPath.<String>read(removed, "$.candidates[0].removedReason")).isEqualTo("duplicate");
		assertThat(JsonPath.<String>read(removed, "$.candidates[0].removedNote")).isEqualTo("Same as Claims Desk.");
		// Both sides see who removed it and when.
		assertThat(JsonPath.<String>read(removed, "$.candidates[0].removedBy")).isEqualTo("buyer-" + word + "@matching.test");
		assertThat(JsonPath.<Boolean>read(removed, "$.candidates[0].removedByOperator")).isFalse();
		assertThat(JsonPath.<String>read(removed, "$.candidates[0].removedAt")).isNotBlank();
		assertProblem(call("POST", buyer, decide + "/shortlist", null), 409, "MATCHING_CANDIDATE_REMOVED");
		assertThat(decision(call("POST", buyer, decide + "/restore", null))).isEqualTo("none");
		// What GenAI Fund removed, only GenAI Fund restores.
		assertThat(decision(call("POST", operator, decide + "/remove", Map.of("reason", "does_not_solve"))))
			.isEqualTo("removed");
		assertProblem(call("POST", buyer, decide + "/restore", null), 403, "MATCHING_REMOVED_BY_OPERATOR");
		// The member reads that GenAI Fund removed it, and not which operator; the operator reads who.
		String hidden = body(call("GET", buyer, path, null).expectStatus().isOk());
		assertThat(JsonPath.<Boolean>read(hidden, "$.candidates[0].removedByOperator")).isTrue();
		assertThat(JsonPath.<Object>read(hidden, "$.candidates[0].removedBy")).isNull();
		assertThat(JsonPath.<String>read(body(call("GET", operator, path, null).expectStatus().isOk()),
				"$.candidates[0].removedBy")).isEqualTo("operator@matching.test");
		assertThat(decision(call("POST", operator, decide + "/restore", null))).isEqualTo("none");

		// An operator adds a solution by hand; a member may not, and a solution is a candidate once.
		UUID second = submittedSolution(owner, "Forms Reader " + word);
		post(operator, "/api/solution/admin/solutions/" + second + "/approve", null);
		await().atMost(WAIT)
			.until(() -> jdbc.sql("select count(*) from search_document where item_id = ?")
				.param(second)
				.query(Long.class)
				.single() == 1);
		assertProblem(call("POST", buyer, path + "/candidates", Map.of("solutionId", second)), 403,
				"MATCHING_OPERATORS_ONLY");
		assertProblem(call("POST", operator, path + "/candidates", Map.of("solutionId", UUID.randomUUID())), 404,
				"MATCHING_SOLUTION_NOT_FOUND");
		assertProblem(call("POST", operator, path + "/candidates", Map.of("solutionId", solution)), 409,
				"MATCHING_ALREADY_CANDIDATE");
		String added = body(call("POST", operator, path + "/candidates", Map.of("solutionId", second)).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(added, "$.candidates[*].origin")).containsExactly("recommended", "added");
		assertThat(JsonPath.<List<Boolean>>read(added, "$.candidates[?(@.origin == 'added')].judged")).containsExactly(false);
		// Adding it queued a run, so a second start is refused; only an operator has all judged again.
		assertThat(JsonPath.<String>read(added, "$.run.state")).isEqualTo("queued");
		assertProblem(call("POST", buyer, path + "/runs", Map.of("judgeAll", true)), 403, "MATCHING_OPERATORS_ONLY");
		assertProblem(call("POST", buyer, path + "/runs", Map.of("judgeAll", false)), 409, "MATCHING_RUN_OPEN");
		runs.work();
		String judged = body(call("GET", buyer, path, null).expectStatus().isOk());
		// The added solution is judged on its own material, which does not hold the quotes the model gave.
		assertThat(JsonPath.<List<Boolean>>read(judged, "$.candidates[*].judged")).containsExactly(true, true);
		assertThat(JsonPath.<List<String>>read(judged, "$.candidates[?(@.origin == 'added')].bucket")).containsExactly("none");
		assertThat(asked).hasSize(4);

		// A member starts as many runs as a day allows, and no more.
		assertThat(JsonPath.<String>read(body(call("POST", buyer, path + "/runs", Map.of("judgeAll", false)).expectStatus()
			.isOk()), "$.run.origin")).isEqualTo("member");
		runs.work();
		String last = body(call("POST", buyer, path + "/runs", Map.of("judgeAll", false)).expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(last, "$.runsLeftToday")).isZero();
		runs.work();
		assertProblem(call("POST", buyer, path + "/runs", Map.of("judgeAll", false)), 429, "MATCHING_RUN_LIMIT");
		// Nothing changed, so those runs asked the model nothing; an operator has every candidate judged again.
		assertThat(asked).hasSize(4);
		// With one read at a time, the provider is never asked for two judgments at once.
		jdbc.sql("update matching_settings set parallel = 1").update();
		mostAtOnce.set(0);
		call("POST", operator, path + "/runs", Map.of("judgeAll", true)).expectStatus().isOk();
		runs.work();
		assertThat(asked).hasSize(6);
		assertThat(mostAtOnce).hasValue(1);
		// With two, both candidates are asked together: the provider answers neither until it holds both calls.
		jdbc.sql("update matching_settings set parallel = 2").update();
		together.set(new CountDownLatch(2));
		call("POST", operator, path + "/runs", Map.of("judgeAll", true)).expectStatus().isOk();
		runs.work();
		together.set(null);
		assertThat(asked).hasSize(8);
		assertThat(mostAtOnce).hasValue(2);
		assertThat(runsOf(useCase)).doesNotContain("waiting operator", "failed operator");

		assertThat(jdbc.sql("select action from audit_event where action like 'matching.%' order by occurred_at")
			.query(String.class)
			.list()).contains("matching.candidate_shortlist", "matching.candidate_remove", "matching.candidate_restore",
					"matching.candidate_add", "matching.run_start");

		// The limits are the operators' to set, one at a time.
		String limits = "/api/matching/admin/settings";
		assertProblem(call("GET", buyer, limits, null), 403, "IDENTITY_OPERATOR_REQUIRED");
		String set = body(call("GET", operator, limits, null).expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(set, "$.memberRunsPerDay")).isEqualTo(2);
		assertThat(JsonPath.<Integer>read(set, "$.parallel")).isEqualTo(2);
		Map<String, Object> change = new HashMap<>(Map.of("settleMinutes", 15, "editRunsPerDay", 4, "memberRunsPerDay",
				5, "candidates", 60, "parallel", 16, "version", JsonPath.<Integer>read(set, "$.version")));
		change.put("runsPerDay", null);
		String kept = body(call("PUT", operator, limits, change).expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(kept, "$.candidates")).isEqualTo(60);
		assertThat(JsonPath.<Integer>read(kept, "$.parallel")).isEqualTo(16);
		assertThat(JsonPath.<Object>read(kept, "$.runsPerDay")).isNull();
		assertProblem(call("PUT", operator, limits, change), 409, "MATCHING_SETTINGS_CHANGED");
		change.put("candidates", 2);
		assertProblem(call("PUT", operator, limits, change), 400, "REQUEST_INVALID");
		// No more than sixteen are read at once, and never none; a refused change keeps nothing.
		change.put("candidates", 60);
		change.put("version", JsonPath.<Integer>read(kept, "$.version"));
		change.put("parallel", 17);
		assertProblem(call("PUT", operator, limits, change), 400, "REQUEST_INVALID");
		change.put("parallel", 0);
		assertProblem(call("PUT", operator, limits, change), 400, "REQUEST_INVALID");
		assertThat(JsonPath.<Integer>read(body(call("GET", operator, limits, null).expectStatus().isOk()), "$.parallel"))
			.isEqualTo(16);
	}

	/** The next line of a stream of events; a stream that says nothing in time fails the test. */
	private static String line(BufferedReader lines) throws Exception {
		return Objects.requireNonNull(CompletableFuture.supplyAsync(() -> {
			try {
				return lines.readLine();
			}
			catch (IOException closed) {
				throw new UncheckedIOException(closed);
			}
		}).get(WAIT.toSeconds(), TimeUnit.SECONDS), "The stream ended");
	}

	/** The next event of a stream, as its name and its body on one line; comments and empty lines are passed over. */
	private static String event(BufferedReader lines) throws Exception {
		String name = line(lines);
		while (!name.startsWith("event:")) {
			name = line(lines);
		}
		return name + " " + line(lines);
	}

	private static String decision(RestTestClient.ResponseSpec response) {
		return JsonPath.read(body(response.expectStatus().isOk()), "$.candidates[0].decision");
	}

	private RestTestClient.ResponseSpec call(String method, String session, String path, @Nullable Object body) {
		RestTestClient.RequestBodySpec request = client.method(org.springframework.http.HttpMethod.valueOf(method))
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session);
		return (body == null ? request : request.contentType(MediaType.APPLICATION_JSON).body(body)).exchange();
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

	private void deck(UUID solution, String firstPage) {
		passages.replace(solution, SearchPassageRepository.DECK, "file-" + firstPage.hashCode(),
				List.of(new Passage(SearchPassageRepository.DECK, 1, 0, null, "Claims Desk, deck page 1", firstPage,
						SearchPassageRepository.READ_AS_TEXT),
						new Passage(SearchPassageRepository.DECK, 2, 0, null, "Claims Desk, deck page 2",
								"It gives adjusters a first assessment of every claim.",
								SearchPassageRepository.READ_AS_TEXT)));
	}

	/** The runs of a use case, oldest first: state and origin. */
	private List<String> runsOf(UUID useCase) {
		return jdbc.sql("select state || ' ' || origin from matching_run where use_case_id = ? order by created_at, id")
			.param(useCase)
			.query(String.class)
			.list();
	}

	/** A candidate in one line: group, required met, place, unread sources, statuses and quote states in order. */
	private String candidate(UUID useCase, UUID solution) {
		return jdbc.sql("""
				select bucket || ' ' || required_met || '/' || required_total || ' ' || found_at || ' '
				    || array_to_string(unread, ',') || ' '
				    || (select string_agg(finding ->> 'status', ',' order by position)
				        from jsonb_array_elements(findings -> 'requirements') with ordinality as found(finding, position))
				    || ' '
				    || (select string_agg(finding ->> 'quoteState', ',' order by position)
				        from jsonb_array_elements(findings -> 'requirements') with ordinality as found(finding, position))
				from matching_candidate where use_case_id = ? and solution_id = ?
				""").param(useCase).param(solution).query(String.class).single();
	}

	/** The steps of the first run of a use case: name, taken in, given out, calls. */
	private List<String> steps(UUID useCase) {
		return jdbc.sql("""
				select s.name || ' ' || s.taken_in || ' ' || s.given_out || ' ' || s.calls
				from matching_run_step s
				where s.run_id = (select id from matching_run where use_case_id = ? order by created_at, id limit 1)
				order by s.position
				""").param(useCase).query(String.class).list();
	}

	/** Connects the stand-in provider, enables one model on it and has matching use it, as an operator does. */
	private void matchingOn(String baseUrl) {
		Map<String, Object> connection = new HashMap<>();
		connection.put("name", "Gateway");
		connection.put("adapterType", "openai");
		connection.put("baseUrl", baseUrl);
		connection.put("enabled", true);
		connection.put("key", "replace");
		connection.put("apiKey", "sk-test-matching");
		connection.put("version", 0);
		String connected = body(send("POST", AI + "/providers", connection));
		String id = JsonPath.read(connected, "$.providers[0].id");
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
		String added = body(send("POST", AI + "/providers/" + id + "/models", Map.of("models", List.of(model))));
		Map<String, Object> task = new HashMap<>();
		task.put("modelId", JsonPath.<String>read(added, "$.providers[0].models[0].id"));
		task.put("reasoningEffort", "medium");
		task.put("version", JsonPath.<Integer>read(added, "$.tasks[0].version"));
		send("PUT", AI + "/tasks/matching", task);
	}

	private RestTestClient.ResponseSpec send(String method, String path, Object body) {
		return client.method(org.springframework.http.HttpMethod.valueOf(method))
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.contentType(MediaType.APPLICATION_JSON)
			.body(body)
			.exchange()
			.expectStatus()
			.isOk();
	}

	/** A chat completion that answers with this JSON, as an OpenAI-compatible gateway does. */
	private String completion(Map<String, Object> content) {
		return json.writeValueAsString(Map.of("id", "chatcmpl-1", "object", "chat.completion", "created", 1, "model",
				"gpt-5-mini", "choices",
				List.of(Map.of("index", 0, "message",
						Map.of("role", "assistant", "content", json.writeValueAsString(content)), "finish_reason", "stop")),
				"usage", Map.of("prompt_tokens", 1200, "completion_tokens", 300, "total_tokens", 1500)));
	}

	/** Waits until the calls counted are all held; a run that never sends them together is answered after the wait. */
	private static void awaitOthers(CountDownLatch others) {
		try {
			others.await(WAIT.toSeconds(), TimeUnit.SECONDS);
		}
		catch (InterruptedException interrupted) {
			Thread.currentThread().interrupt();
		}
	}

	private static void answer(HttpExchange exchange, int status, String body) throws IOException {
		byte[] bytes = body.getBytes(UTF_8);
		exchange.getResponseHeaders().add("Content-Type", "application/json");
		exchange.sendResponseHeaders(status, bytes.length);
		exchange.getResponseBody().write(bytes);
		exchange.close();
	}

	private static Map<String, Object> useCase(String title, UUID organization) {
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
		request.put("closesAt", java.time.Instant.now().plus(Duration.ofDays(30)).toString());
		request.put("hideOrganizationName", true);
		request.put("publishNow", true);
		return request;
	}

	private UUID organization(String session, String name) {
		Map<String, Object> request = new HashMap<>(Map.of("name", name, "type", "company", "country", "VN", "teamSize",
				"2_9", "industries", List.of("insurance"), "website", "https://example.test", "description",
				"Assistants for insurers.", "foundedYear", 2021, "jobTitle", "Founder"));
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

	private UUID submittedSolution(String owner, String name) {
		String draft = body(client.post()
			.uri("/api/solution/mine")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", name))
			.exchange()
			.expectStatus()
			.isCreated());
		UUID id = UUID.fromString(JsonPath.read(draft, "$.id"));
		Map<String, Object> request = new HashMap<>();
		request.put("name", name);
		request.put("summary", "Answers calls and chats for insurers.");
		request.put("problemsSolved", null);
		request.put("valueProposition", null);
		request.put("focusAreas", List.of("document_processing"));
		request.put("industries", List.of("insurance"));
		request.put("maturity", "pilot");
		request.put("deployment", List.of("cloud_saas"));
		request.put("website", "https://example.test");
		request.put("demoUrl", null);
		request.put("builtWith", List.of("LangGraph"));
		request.put("languages", List.of());
		request.put("imageFileIds", List.of());
		request.put("listed", true);
		request.put("version", JsonPath.<Number>read(draft, "$.version").longValue());
		request.put("logoFileId", TestUploads.image(client, owner, "solution_logo", "logo.png"));
		request.put("coverFileId", TestUploads.image(client, owner, "solution_image", "cover.png"));
		client.put()
			.uri("/api/solution/mine/" + id)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.exchange()
			.expectStatus()
			.isOk();
		post(owner, "/api/solution/mine/" + id + "/submit", null);
		return id;
	}

	private void post(String session, String path, @Nullable Object body) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session);
		(body == null ? request : request.contentType(MediaType.APPLICATION_JSON).body(body)).exchange()
			.expectStatus()
			.is2xxSuccessful();
	}

	private static String body(RestTestClient.ResponseSpec response) {
		return new String(response.expectBody().returnResult().getResponseBody(), UTF_8);
	}

	/** The test mailbox, imported through a class of this test's own so that the test keeps a context of its own. */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

}
