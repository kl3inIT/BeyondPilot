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

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import ai.genaifund.beyondpilot.storage.TestUploads;
import com.jayway.jsonpath.JsonPath;
import org.jspecify.annotations.Nullable;
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
	private TestMailbox mail;

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
		// A solution is found with its logo.
		assertThat(JsonPath.<String>read(search("langgraph%20" + word), "$.items[0].photoFileId")).isNotBlank();

		renameOrganization(owner, "Renamed " + word);
		await().atMost(WAIT).until(() -> total("renamed " + word) == 1);

		Map<String, Object> unlisted = asSaved(owner, solution, "Voice Agent " + word);
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
		Map<String, Object> request = solution(name, JsonPath.<Number>read(draft, "$.version").longValue());
		// A review asks for a logo and a cover.
		request.put("logoFileId", TestUploads.image(client, owner, "solution_logo", "logo.png"));
		request.put("coverFileId", TestUploads.image(client, owner, "solution_image", "cover.png"));
		put(owner, "/api/solution/mine/" + id, request);
		post(owner, "/api/solution/mine/" + id + "/submit", null);
		return id;
	}

	/** The save that keeps the solution as it is: its version, and the images it names. */
	private Map<String, Object> asSaved(String owner, UUID id, String name) {
		String current = body(client.get()
			.uri("/api/solution/mine/" + id)
			.cookie(TestSignIn.SESSION_COOKIE, owner)
			.exchange()
			.expectStatus()
			.isOk());
		Map<String, Object> request = solution(name, JsonPath.<Number>read(current, "$.version").longValue());
		request.put("logoFileId", JsonPath.<String>read(current, "$.logo.fileId"));
		request.put("coverFileId", JsonPath.<String>read(current, "$.cover.fileId"));
		return request;
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
		request.put("imageFileIds", List.of());
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

	/**
	 * The test mailbox, imported through a class of this test's own so that the test keeps a Spring context, and with
	 * it a database, of its own.
	 */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

}
