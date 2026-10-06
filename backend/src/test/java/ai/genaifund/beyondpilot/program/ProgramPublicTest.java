package ai.genaifund.beyondpilot.program;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
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
 * The programs as visitors read them, over real HTTP against PostgreSQL and without a session: what the list holds
 * and in which phase, what a page shows, and that a draft is found by an operator only. The programs are written
 * straight into the tables, with dates around the moment the test runs.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@public.test")
@Import({ TestcontainersConfiguration.class, ProgramPublicTest.Mail.class })
class ProgramPublicTest {

	private static final String PROGRAMS = "/api/program/programs";

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	/** Keeps this test's programs apart from those other tests write. */
	private String tag;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
		tag = UUID.randomUUID().toString().substring(0, 8);
	}

	@Test
	void theListHoldsPublishedProgramsOnlyEachInThePhaseItIsInNow() {
		Instant now = Instant.now();
		LocalDate today = LocalDate.now(ProgramPhase.ZONE);
		program("open", "published", "enterprise_challenge", today.minusDays(1), today.plusDays(30),
				now.minus(Duration.ofDays(1)), now.plus(Duration.ofDays(5)));
		program("upcoming", "published", "event", today.plusDays(10), today.plusDays(10), null, null);
		program("running", "published", "accelerator", today.minusDays(20), today.plusDays(20),
				now.minus(Duration.ofDays(15)), now.minus(Duration.ofDays(5)));
		program("done", "published", "buildathon", today.minusDays(40), today.minusDays(10), null, null);
		program("draft", "draft", "event", today.minusDays(1), today.plusDays(30), null, null);

		Map<String, String> phases = phases("");
		assertThat(phases).containsEntry(slug("open"), "open")
			.containsEntry(slug("upcoming"), "upcoming")
			.containsEntry(slug("running"), "running")
			.containsEntry(slug("done"), "done")
			.doesNotContainKey(slug("draft"));
		assertThat(phases("?phase=open")).containsKey(slug("open")).doesNotContainKeys(slug("upcoming"), slug("done"));
		assertThat(phases("?type=buildathon")).containsKey(slug("done")).doesNotContainKey(slug("open"));
		assertThat(phases("?phase=done&type=buildathon")).containsKey(slug("done"));
	}

	@Test
	void aProgramOnTheListCarriesItsWindowAndItsNextThreeEvents() {
		Instant now = Instant.now();
		LocalDate today = LocalDate.now(ProgramPhase.ZONE);
		UUID id = program("events", "published", "enterprise_challenge", today.minusDays(1), today.plusDays(30),
				now.minus(Duration.ofDays(1)), now.plus(Duration.ofDays(5)));
		event(id, 0, "Already held", now.minus(Duration.ofDays(2)));
		event(id, 1, "Fourth", now.plus(Duration.ofDays(8)));
		event(id, 2, "First", now.plus(Duration.ofDays(2)));
		event(id, 3, "Third", now.plus(Duration.ofDays(6)));
		event(id, 4, "Second", now.plus(Duration.ofDays(4)));

		String body = list("");
		String item = "$.items[?(@.slug == '" + slug("events") + "')]";
		assertThat(JsonPath.<List<String>>read(body, item + ".upcomingEvents[*].title")).containsExactly("First", "Second",
				"Third");
		assertThat(JsonPath.<List<Integer>>read(body, item + ".applications.shortlistSize")).containsExactly(10);
		assertThat(JsonPath.<List<String>>read(body, item + ".summary")).containsExactly("What the program is.");
	}

	@Test
	void aParameterOutOfBoundsIsAValidationProblem() {
		String body = new String(client.get()
			.uri(URI.create("http://localhost:" + port + PROGRAMS + "?phase=soon&type=summit"))
			.exchange()
			.expectStatus()
			.isBadRequest()
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8);

		assertThat(JsonPath.<List<String>>read(body, "$.errors[*].pointer")).containsExactlyInAnyOrder("#/phase", "#/type");
	}

	@Test
	void aPublishedProgramsPageCarriesWhatItShows() {
		Instant now = Instant.now();
		LocalDate today = LocalDate.now(ProgramPhase.ZONE);
		UUID id = program("page", "published", "enterprise_challenge", today.minusDays(1), today.plusDays(30),
				now.minus(Duration.ofDays(1)), now.plus(Duration.ofDays(5)));
		event(id, 0, "Briefing", now.plus(Duration.ofDays(2)));
		jdbc.sql("""
				insert into program_milestone (program_id, position, title, starts_at, all_day)
				values (?, 0, 'Demo day', ?, true)
				""").params(id, Timestamp.from(now.plus(Duration.ofDays(20)))).update();

		client.get()
			.uri(PROGRAMS + "/" + slug("page"))
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.name")
			.isEqualTo("Program " + slug("page"))
			.jsonPath("$.about")
			.isEqualTo("The text of the page.")
			.jsonPath("$.phase")
			.isEqualTo("open")
			.jsonPath("$.status")
			.isEqualTo("published")
			.jsonPath("$.pageKind")
			.isEqualTo("standard")
			.jsonPath("$.applications.outcomesDueOn")
			.isNotEmpty()
			.jsonPath("$.keyDates[0].title")
			.isEqualTo("Demo day")
			.jsonPath("$.keyDates[0].allDay")
			.isEqualTo(true)
			.jsonPath("$.events[0].title")
			.isEqualTo("Briefing");
	}

	@Test
	void aDraftIsFoundByAnOperatorOnly() {
		LocalDate today = LocalDate.now(ProgramPhase.ZONE);
		program("preview", "draft", "event", today, today.plusDays(1), null, null);
		String user = TestSignIn.session(client, mail, "visitor@public.test");
		String operator = TestSignIn.session(client, mail, "operator@public.test");
		String page = PROGRAMS + "/" + slug("preview");

		assertNotFound(client.get().uri(page).exchange());
		assertNotFound(client.get().uri(page).cookie(TestSignIn.SESSION_COOKIE, user).exchange());
		client.get()
			.uri(page)
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.status")
			.isEqualTo("draft");
		assertThat(phases("")).doesNotContainKey(slug("preview"));
	}

	@Test
	void anUnknownAddressIsNotFound() {
		assertNotFound(client.get().uri(PROGRAMS + "/no-such-program-" + tag).exchange());
	}

	private String slug(String name) {
		return name + "-" + tag;
	}

	private UUID program(String name, String status, String type, LocalDate startsOn, LocalDate endsOn, Instant opensAt,
			Instant closesAt) {
		UUID id = UUID.randomUUID();
		jdbc.sql("""
				insert into program (id, slug, name, type, summary, about, starts_on, ends_on, status, published_at,
				                     applications_open_at, applications_close_at, shortlist_size, outcomes_due_on)
				values (:id, :slug, :name, :type, 'What the program is.', 'The text of the page.', :startsOn, :endsOn,
				        :status, :publishedAt, :opensAt, :closesAt, :shortlist, :outcomes)
				""")
			.param("id", id)
			.param("slug", slug(name))
			.param("name", "Program " + slug(name))
			.param("type", type)
			.param("startsOn", startsOn)
			.param("endsOn", endsOn)
			.param("status", status)
			.param("publishedAt", status.equals("published") ? Timestamp.from(Instant.now()) : null)
			.param("opensAt", opensAt == null ? null : Timestamp.from(opensAt))
			.param("closesAt", closesAt == null ? null : Timestamp.from(closesAt))
			.param("shortlist", opensAt == null ? null : 10)
			.param("outcomes", closesAt == null ? null : LocalDate.ofInstant(closesAt, ProgramPhase.ZONE).plusDays(1))
			.update();
		return id;
	}

	private void event(UUID program, int position, String title, Instant startsAt) {
		jdbc.sql("""
				insert into program_event (program_id, position, title, starts_at, online)
				values (?, ?, ?, ?, true)
				""").params(program, position, title, Timestamp.from(startsAt)).update();
	}

	private String list(String query) {
		return new String(client.get()
			.uri(URI.create("http://localhost:" + port + PROGRAMS + query))
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8);
	}

	/** Each program on the list by its address, with its phase. */
	private Map<String, String> phases(String query) {
		String body = list(query);
		List<String> slugs = JsonPath.read(body, "$.items[*].slug");
		List<String> phases = JsonPath.read(body, "$.items[*].phase");
		Map<String, String> out = new HashMap<>();
		for (int i = 0; i < slugs.size(); i++) {
			out.put(slugs.get(i), phases.get(i));
		}
		return out;
	}

	private static void assertNotFound(RestTestClient.ResponseSpec response) {
		response.expectStatus()
			.isNotFound()
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo("PROGRAM_NOT_FOUND");
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
