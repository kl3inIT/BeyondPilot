package ai.genaifund.beyondpilot.search;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.net.URI;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.RecordingMailSender;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import com.jayway.jsonpath.JsonPath;
import org.jspecify.annotations.Nullable;
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
 * Solutions and talent in search over real HTTP against PostgreSQL, changed the way their owners and operators change
 * them: approved items are found without a session, an unlisted solution stays in the index for matching but out of a
 * visitor's results, a renamed organization is shown under its new name, and a rejected or unlisted item leaves. Only
 * the SMTP server is replaced.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@directories.test")
@Import({ TestcontainersConfiguration.class, SearchDirectoriesTest.Mail.class })
class SearchDirectoriesTest {

	private static final Duration WAIT = Duration.ofSeconds(10);

	@LocalServerPort
	private int port;

	@Autowired
	private RecordingMailSender mail;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	private String operator;

	/** A word only this test's items carry, so other tests' items never match. */
	private String word;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
		operator = TestSignIn.session(client, mail, "operator@directories.test");
		word = "zq" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
	}

	@Test
	void anApprovedSolutionIsFoundUnderItsOrganizationAndLeavesTheResultsWhenUnlistedOrRejected() {
		String owner = TestSignIn.session(client, mail, "owner-" + word + "@directories.test");
		UUID organization = organization(owner, "Revve " + word);
		post(operator, "/api/organization/admin/organizations/" + organization + "/approve", Map.of());
		UUID solution = submittedSolution(owner, "Voice Agent " + word);
		assertThat(total("voice agent " + word)).isZero();

		post(operator, "/api/solution/admin/solutions/" + solution + "/approve", null);
		await().atMost(WAIT).until(() -> total("voice agent " + word) == 1);
		String body = search("voice%20agent%20" + word);
		assertThat(JsonPath.<String>read(body, "$.items[0].kind")).isEqualTo("solution");
		assertThat(JsonPath.<String>read(body, "$.items[0].subtitle")).isEqualTo("Revve " + word);
		assertThat(JsonPath.<String>read(body, "$.items[0].maturity")).isEqualTo("pilot");
		assertThat(JsonPath.<Integer>read(body, "$.items[0].customerDeployments")).isZero();
		assertThat(JsonPath.<List<String>>read(body, "$.items[0].industries")).containsExactly("insurance");
		assertThat(JsonPath.<String>read(body, "$.items[0].organizationSlug")).isNotBlank();
		// A code is found as the words it stands for.
		assertThat(total("document processing " + word)).isEqualTo(1);
		// And a tool it is built with, by its name.
		assertThat(total("langgraph " + word)).isEqualTo(1);

		renameOrganization(owner, "Renamed " + word);
		await().atMost(WAIT).until(() -> total("renamed " + word) == 1);

		Map<String, Object> unlisted = solution("Voice Agent " + word, versionOfSolution(owner, solution));
		unlisted.put("listed", false);
		put(owner, "/api/solution/mine/" + solution, unlisted);
		await().atMost(WAIT).until(() -> total("voice agent " + word) == 0);
		// Matching may still use it.
		assertThat(listed(solution)).isFalse();

		post(operator, "/api/solution/admin/solutions/" + solution + "/reject",
				Map.of("reason", "other", "message", "Tell us where the model is."));
		await().atMost(WAIT).until(() -> listed(solution) == null);
	}

	@Test
	void anApprovedListedProfileIsFoundAndLeavesTheResultsWhenUnlisted() {
		String person = TestSignIn.session(client, mail, "person-" + word + "@directories.test");
		String saved = body(put(person, "/api/talent/mine", profile("Lan " + word, null)));
		UUID profile = UUID.fromString(JsonPath.read(saved, "$.id"));
		post(person, "/api/talent/mine/submit", null);
		assertThat(total("lan " + word)).isZero();

		post(operator, "/api/talent/admin/profiles/" + profile + "/approve", null);
		await().atMost(WAIT).until(() -> total("lan " + word) == 1);
		String body = search("langgraph%20" + word);
		assertThat(JsonPath.<String>read(body, "$.items[0].kind")).isEqualTo("talent");
		assertThat(JsonPath.<String>read(body, "$.items[0].subtitle")).isEqualTo("Builds claims AI");
		assertThat(JsonPath.<List<String>>read(body, "$.items[0].roles")).containsExactly("ml_engineer");
		assertThat(JsonPath.<String>read(body, "$.items[0].worksAt")).isEqualTo("Revve AI");
		assertThat(JsonPath.<String>read(body, "$.items[0].city")).isEqualTo("Ho Chi Minh City");

		String mine = body(client.get()
			.uri("/api/talent/mine")
			.cookie(TestSignIn.SESSION_COOKIE, person)
			.exchange()
			.expectStatus()
			.isOk());
		Map<String, Object> unlisted = profile("Lan " + word,
				JsonPath.<Number>read(mine, "$.profile.version").longValue());
		unlisted.put("listed", false);
		put(person, "/api/talent/mine", unlisted);
		await().atMost(WAIT).until(() -> total("lan " + word) == 0);
		assertThat(listed(profile)).isNull();
	}

	@Test
	void aPublishedUseCaseIsFoundUntilItIsSentBackAndNeverByTheNameOfAnOrganizationThatHidesIt() {
		String owner = TestSignIn.session(client, mail, "bank-" + word + "@directories.test");
		UUID organization = organization(owner, "Bank " + word);
		post(operator, "/api/organization/admin/organizations/" + organization + "/approve", Map.of());
		String created = body(client.post()
			.uri("/api/usecase/admin/use-cases")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.contentType(MediaType.APPLICATION_JSON)
			.body(useCase("Claims triage " + word, organization))
			.exchange()
			.expectStatus()
			.is2xxSuccessful());
		String id = JsonPath.read(created, "$.id");

		await().atMost(WAIT).until(() -> total("claims triage " + word) == 1);
		String body = search("claims%20triage%20" + word);
		assertThat(JsonPath.<String>read(body, "$.items[0].kind")).isEqualTo("use_case");
		assertThat(JsonPath.<String>read(body, "$.items[0].slug")).isEqualTo(id);
		assertThat(JsonPath.<Object>read(body, "$.items[0].subtitle")).isNull();
		assertThat(JsonPath.<Integer>read(body, "$.counts.useCase")).isEqualTo(1);
		// The organization asked to stay anonymous: its name finds nothing.
		assertThat(total("bank " + word)).isZero();
		// Only what the public list shows is searched: the goal, never the problem statement members read.
		assertThat(total("first assessment " + word)).isEqualTo(1);
		assertThat(total("wait days " + word)).isZero();

		post(operator, "/api/usecase/admin/use-cases/" + id + "/send-back", Map.of("reason", "Say what the data is."));
		await().atMost(WAIT).until(() -> total("claims triage " + word) == 0);
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

	/** Whether the item's row is listed, or null when the index has no row for it. */
	private @Nullable Boolean listed(UUID itemId) {
		return jdbc.sql("select listed from search_document where item_id = ?")
			.param(itemId)
			.query(Boolean.class)
			.optional()
			.orElse(null);
	}

	private long total(String query) {
		return JsonPath.<Number>read(search(query.replace(" ", "%20")), "$.total").longValue();
	}

	private String search(String query) {
		return body(client.get()
			.uri(URI.create("http://localhost:" + port + "/api/search?q=" + query))
			.exchange()
			.expectStatus()
			.isOk());
	}

	private UUID organization(String session, String name) {
		Map<String, Object> request = new HashMap<>(organizationProfile(name));
		request.put("jobTitle", "Founder");
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

	private void renameOrganization(String owner, String name) {
		String mine = body(client.get()
			.uri("/api/organization/mine")
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.exchange()
			.expectStatus()
			.isOk());
		Map<String, Object> request = new HashMap<>(organizationProfile(name));
		request.put("version", JsonPath.<Number>read(mine, "$.organization.version").longValue());
		put(owner, "/api/organization/mine", request);
	}

	private static Map<String, Object> organizationProfile(String name) {
		return Map.of("name", name, "type", "company", "country", "VN", "teamSize", "2_9", "industries",
				List.of("insurance"), "website", "https://example.test", "description", "Assistants for insurers.",
				"foundedYear", 2021, "jobTitle", "Founder");
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
		put(owner, "/api/solution/mine/" + id,
				solution(name, JsonPath.<Number>read(draft, "$.version").longValue()));
		post(owner, "/api/solution/mine/" + id + "/submit", null);
		return id;
	}

	private long versionOfSolution(String owner, UUID id) {
		return JsonPath.<Number>read(body(client.get()
			.uri("/api/solution/mine/" + id)
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.exchange()
			.expectStatus()
			.isOk()), "$.version").longValue();
	}

	private static Map<String, Object> solution(String name, long version) {
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
		request.put("listed", true);
		request.put("version", version);
		return request;
	}

	private static Map<String, Object> profile(String name, @Nullable Long version) {
		Map<String, Object> request = new HashMap<>();
		request.put("name", name);
		request.put("headline", "Builds claims AI");
		request.put("bio", "Ten years of machine learning in insurance.");
		request.put("roles", List.of("ml_engineer"));
		request.put("skills", List.of("Python", "LangGraph"));
		request.put("country", "VN");
		request.put("engagement", List.of("contract"));
		request.put("rateBand", "50_100");
		request.put("website", "https://example.test");
		request.put("photoFileId", null);
		request.put("city", "Ho Chi Minh City");
		request.put("languages", List.of("vi", "en"));
		request.put("industries", List.of("insurance"));
		request.put("worksAt", "Revve AI");
		request.put("projects", List.of());
		request.put("listed", true);
		request.put("version", version);
		return request;
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

	private RestTestClient.ResponseSpec put(String session, String path, Object body) {
		return client.put()
			.uri(path)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(body)
			.exchange()
			.expectStatus()
			.isOk();
	}

	private static String body(RestTestClient.ResponseSpec response) {
		return new String(response.expectBody().returnResult().getResponseBody(), UTF_8);
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class Mail {

		@Bean
		RecordingMailSender recordingMailSender() {
			return new RecordingMailSender();
		}

	}

}
