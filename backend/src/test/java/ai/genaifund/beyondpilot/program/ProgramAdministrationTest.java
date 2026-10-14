package ai.genaifund.beyondpilot.program;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
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
import org.springframework.http.client.JdkClientHttpRequestFactory;
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
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
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
		save(null, one, program(0, "Guarded", "guarded")).expectStatus().isUnauthorized();
		assertProblem(save(user, one, program(0, "Taken over", "guarded")), 403, "IDENTITY_OPERATOR_REQUIRED");
		for (String command : List.of("publish", "unpublish")) {
			command(null, one, command).expectStatus().isUnauthorized();
			assertProblem(command(user, one, command), 403, "IDENTITY_OPERATOR_REQUIRED");
		}
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
	void theListPutsTheProgramTakingApplicationsBeforeTheOnesThatAreOver() {
		String open = created("Open now", "listed-open-now");
		String done = created("Over", "listed-over");
		String comingUp = created("Coming up", "listed-coming-up");
		Map<String, Object> taking = program(0, "Open now", "listed-open-now");
		taking.put("startsOn", "2020-01-01");
		taking.put("endsOn", "2999-12-31");
		taking.put("applications", applications("2020-01-01T00:00:00Z", "2999-12-01T00:00:00Z", "2999-12-15"));
		save(operator, open, taking).expectStatus().isOk();
		Map<String, Object> over = program(0, "Over", "listed-over");
		over.put("startsOn", "2020-01-01");
		over.put("endsOn", "2020-01-02");
		save(operator, done, over).expectStatus().isOk();
		Map<String, Object> later = program(0, "Coming up", "listed-coming-up");
		later.put("startsOn", "2999-01-01");
		later.put("endsOn", "2999-01-02");
		save(operator, comingUp, later).expectStatus().isOk();

		assertThat(slugs()).containsSubsequence("listed-open-now", "listed-coming-up", "listed-over");
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
		String missing = PROGRAMS + "/00000000-0000-0000-0000-000000000000";
		assertProblem(get(operator, missing), 404, "PROGRAM_NOT_FOUND");
		assertProblem(command(operator, missing, "publish"), 404, "PROGRAM_NOT_FOUND");
		assertProblem(command(operator, missing, "unpublish"), 404, "PROGRAM_NOT_FOUND");
	}

	@Test
	void aProgramIsPublishedOnceItHasWhatTheListShowsAndUnpublishedAtWill() {
		String one = created("Published", "published-at-will");
		get(operator, one).expectBody()
			.jsonPath("$.publishIssues")
			.isEqualTo(List.of("summary", "cover", "dates"))
			.jsonPath("$.status")
			.isEqualTo("draft");

		assertProblem(command(operator, one, "publish"), 400, "PROGRAM_NOT_READY_TO_PUBLISH");

		Map<String, Object> program = program(0, "Published", "published-at-will");
		program.put("summary", "Insurers name what they need; providers answer.");
		program.put("coverFileId", storedImage("operator@program.test"));
		program.put("startsOn", "2026-09-23");
		program.put("endsOn", "2026-12-05");
		save(operator, one, program).expectStatus().isOk().expectBody().jsonPath("$.publishIssues").isEmpty();

		command(operator, one, "publish").expectStatus().isNoContent();
		command(operator, one, "publish").expectStatus().isNoContent();

		// While it is public, a save keeps what publishing asked for.
		Map<String, Object> bare = new LinkedHashMap<>(program);
		bare.put("version", JsonPath.<Integer>read(body(get(operator, one).expectStatus().isOk()), "$.version"));
		bare.put("coverFileId", null);
		assertProblem(save(operator, one, bare), 400, "PROGRAM_PUBLISHED_INCOMPLETE");
		get(operator, one).expectBody()
			.jsonPath("$.status")
			.isEqualTo("published")
			.jsonPath("$.slugFixed")
			.isEqualTo(true);

		command(operator, one, "unpublish").expectStatus().isNoContent();
		command(operator, one, "unpublish").expectStatus().isNoContent();
		// Taken down, the program keeps its address, and it stays fixed.
		get(operator, one).expectBody()
			.jsonPath("$.status")
			.isEqualTo("draft")
			.jsonPath("$.slug")
			.isEqualTo("published-at-will")
			.jsonPath("$.slugFixed")
			.isEqualTo(true);
		// A repeated command changes nothing and records nothing.
		assertThat(eventsOf(one.substring(one.lastIndexOf('/') + 1))).extracting(event -> event.get("action"))
			.containsExactly("program.create", "program.update", "program.publish", "program.unpublish");
	}

	@Test
	void anOperatorFeaturesAProgramWithoutTouchingWhatASaveSends() {
		String one = created("Featured", "featured-by-operator");
		String user = TestSignIn.session(client, mail, "featuring@program.test");
		assertProblem(command(user, one, "feature"), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(command(user, one, "unfeature"), 403, "IDENTITY_OPERATOR_REQUIRED");
		command(null, one, "feature").expectStatus().isUnauthorized();
		assertProblem(command(operator, PROGRAMS + "/" + UUID.randomUUID(), "feature"), 404, "PROGRAM_NOT_FOUND");

		// A draft can be featured; featured again, the first time stays and nothing new is recorded.
		command(operator, one, "feature").expectStatus().isNoContent();
		String featuredAt = JsonPath.read(body(get(operator, one).expectStatus().isOk()), "$.featuredAt");
		command(operator, one, "feature").expectStatus().isNoContent();
		get(operator, one).expectBody().jsonPath("$.featuredAt").isEqualTo(featuredAt);
		String list = body(get(operator, PROGRAMS).expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(list, "$.items[?(@.slug == 'featured-by-operator')].featuredAt"))
			.containsExactly(featuredAt);

		// A save sent with the version read before featuring is not refused, and keeps the program featured.
		save(operator, one, program(0, "Featured, renamed", "featured-by-operator")).expectStatus().isOk();
		get(operator, one).expectBody().jsonPath("$.featuredAt").isEqualTo(featuredAt);

		command(operator, one, "unfeature").expectStatus().isNoContent();
		command(operator, one, "unfeature").expectStatus().isNoContent();
		get(operator, one).expectBody().jsonPath("$.featuredAt").isEmpty();
		assertThat(eventsOf(one.substring(one.lastIndexOf('/') + 1))).extracting(event -> event.get("action"))
			.containsExactly("program.create", "program.feature", "program.update", "program.unfeature");
	}

	private RestTestClient.ResponseSpec command(String session, String uri, String command) {
		RestTestClient.RequestBodySpec request = client.post().uri(uri + "/" + command).header(TestSignIn.CSRF_HEADER, "1");
		if (session != null) {
			request = request.cookie(TestSignIn.SESSION_COOKIE, session);
		}
		return request.exchange();
	}

	@Test
	void aSaveKeepsEverythingTheScreenHolds() {
		String one = created("Saved whole", "saved-whole");
		UUID cover = storedImage("operator@program.test");
		Map<String, Object> program = program(0, "  AI for Insurance Challenge  ", "saved-whole");
		program.put("type", "enterprise_challenge");
		program.put("partnerName", " Tasco ");
		program.put("summary", "Insurers name what they need; providers answer.");
		program.put("about", "   ");
		program.put("startsOn", "2026-10-01");
		program.put("endsOn", "2026-12-18");
		program.put("pageKind", "custom");
		program.put("coverFileId", cover);
		program.put("applications", applications("2026-10-01T02:00:00Z", "2026-11-15T16:59:00Z", "2026-11-16"));
		program.put("keyDates",
				List.of(keyDate("Briefing", "2026-10-09T07:00:00Z", "2026-10-09T09:00:00Z", false),
						keyDate("Demo day", "2026-12-17T17:00:00Z", null, true)));
		program.put("events", List.of(Map.of("title", "Briefing for providers", "startsAt", "2026-10-09T07:00:00Z",
				"online", true, "registrationUrl", "https://luma.com/briefing")));

		save(operator, one, program).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.name")
			.isEqualTo("AI for Insurance Challenge")
			.jsonPath("$.version")
			.isEqualTo(1);

		get(operator, one).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.type")
			.isEqualTo("enterprise_challenge")
			.jsonPath("$.partnerName")
			.isEqualTo("Tasco")
			.jsonPath("$.about")
			.isEmpty()
			.jsonPath("$.startsOn")
			.isEqualTo("2026-10-01")
			.jsonPath("$.endsOn")
			.isEqualTo("2026-12-18")
			.jsonPath("$.pageKind")
			.isEqualTo("custom")
			.jsonPath("$.slugFixed")
			.isEqualTo(false)
			.jsonPath("$.coverFileId")
			.isEqualTo(cover.toString())
			.jsonPath("$.applications.opensAt")
			.isEqualTo("2026-10-01T02:00:00Z")
			.jsonPath("$.applications.closesAt")
			.isEqualTo("2026-11-15T16:59:00Z")
			.jsonPath("$.applications.shortlistSize")
			.isEqualTo(10)
			.jsonPath("$.applications.outcomesDueOn")
			.isEqualTo("2026-11-16")
			.jsonPath("$.applications.allowUpdatesUntilClose")
			.isEqualTo(true)
			.jsonPath("$.keyDates.length()")
			.isEqualTo(2)
			.jsonPath("$.keyDates[0].title")
			.isEqualTo("Briefing")
			.jsonPath("$.keyDates[0].endsAt")
			.isEqualTo("2026-10-09T09:00:00Z")
			.jsonPath("$.keyDates[1].title")
			.isEqualTo("Demo day")
			.jsonPath("$.keyDates[1].allDay")
			.isEqualTo(true)
			.jsonPath("$.events[0].registrationUrl")
			.isEqualTo("https://luma.com/briefing")
			.jsonPath("$.events[0].city")
			.isEmpty();
		assertThat(eventsOf(one.substring(one.lastIndexOf('/') + 1))).extracting(event -> event.get("action"))
			.containsExactly("program.create", "program.update");
		// The operators' list shows the window and the phase it works out from the dates.
		String list = new String(get(operator, PROGRAMS).expectBody().returnResult().getResponseBody(), UTF_8);
		String item = "$.items[?(@.slug == 'saved-whole')]";
		assertThat(JsonPath.<List<String>>read(list, item + ".applications.closesAt"))
			.containsExactly("2026-11-15T16:59:00Z");
		assertThat(JsonPath.<List<String>>read(list, item + ".phase")).singleElement().isNotNull();
	}

	@Test
	void aSaveReplacesTheListsAndTheWindowAsSent() {
		String one = created("Replaced", "replaced");
		Map<String, Object> program = program(0, "Replaced", "replaced");
		program.put("applications", applications("2099-10-01T02:00:00Z", "2099-11-15T16:59:00Z", null));
		program.put("keyDates",
				List.of(keyDate("First", "2026-10-09T07:00:00Z", null, false),
						keyDate("Second", "2026-10-10T07:00:00Z", null, false),
						keyDate("Third", "2026-10-11T07:00:00Z", null, false)));
		save(operator, one, program).expectStatus().isOk();

		Map<String, Object> shorter = program(1, "Replaced", "replaced");
		shorter.put("keyDates", List.of(keyDate("Third", "2026-10-11T07:00:00Z", null, false),
				keyDate("First", "2026-10-09T07:00:00Z", null, false)));

		save(operator, one, shorter).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.applications")
			.isEmpty()
			.jsonPath("$.keyDates[*].title")
			.isEqualTo(List.of("Third", "First"));
	}

	@Test
	void aSaveOverSomeoneElsesSaveIsRefused() {
		String one = created("Shared", "shared-screen");
		save(operator, one, program(0, "Saved first", "shared-screen")).expectStatus().isOk();

		assertProblem(save(operator, one, program(0, "Saved second", "shared-screen")), 409,
				"PROGRAM_CHANGED_MEANWHILE");

		get(operator, one).expectBody().jsonPath("$.name").isEqualTo("Saved first");
	}

	@Test
	void datesOutOfOrderAreRefused() {
		String one = created("Ordered", "ordered");

		Map<String, Object> days = program(0, "Ordered", "ordered");
		days.put("startsOn", "2026-12-18");
		days.put("endsOn", "2026-12-17");
		assertProblem(save(operator, one, days), 400, "PROGRAM_DAYS_OUT_OF_ORDER");

		Map<String, Object> window = program(0, "Ordered", "ordered");
		window.put("applications", applications("2026-11-15T16:59:00Z", "2026-11-15T16:59:00Z", null));
		assertProblem(save(operator, one, window), 400, "PROGRAM_WINDOW_OUT_OF_ORDER");

		// The deadline is 23:59 on 15 November in Vietnam, so the 15th is still in time and the 14th is not.
		Map<String, Object> outcomes = program(0, "Ordered", "ordered");
		outcomes.put("applications", applications("2026-10-01T02:00:00Z", "2026-11-15T16:59:00Z", "2026-11-14"));
		assertProblem(save(operator, one, outcomes), 400, "PROGRAM_OUTCOMES_BEFORE_CLOSE");

		Map<String, Object> keyDate = program(0, "Ordered", "ordered");
		keyDate.put("keyDates", List.of(keyDate("Backwards", "2026-10-09T09:00:00Z", "2026-10-09T07:00:00Z", false)));
		assertProblem(save(operator, one, keyDate), 400, "PROGRAM_KEY_DATE_OUT_OF_ORDER");

		Map<String, Object> event = program(0, "Ordered", "ordered");
		event.put("events", List.of(Map.of("title", "Backwards", "startsAt", "2026-10-09T09:00:00Z", "endsAt",
				"2026-10-09T07:00:00Z", "online", false)));
		assertProblem(save(operator, one, event), 400, "PROGRAM_EVENT_OUT_OF_ORDER");

		Map<String, Object> elsewhere = program(0, "Ordered", "ordered");
		elsewhere.put("pageKind", "external");
		assertProblem(save(operator, one, elsewhere), 400, "PROGRAM_EXTERNAL_URL_REQUIRED");

		get(operator, one).expectBody().jsonPath("$.version").isEqualTo(0);
	}

	@Test
	void anEventHeldInPersonNamesItsCityOnceItIsAddedOrChanged() {
		String one = created("Placed", "placed");
		String id = one.substring(one.lastIndexOf('/') + 1);

		Map<String, Object> nowhere = program(0, "Placed", "placed");
		nowhere.put("events", List.of(event("Meetup", false, " ")));
		assertProblem(save(operator, one, nowhere), 400, "PROGRAM_EVENT_CITY_REQUIRED");

		// An online event has no place, and a city is enough for one held in person.
		Map<String, Object> placed = program(0, "Placed", "placed");
		placed.put("events", List.of(event("Webinar", true, null), event("Meetup", false, " Ho Chi Minh City ")));
		save(operator, one, placed).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.events[0].city")
			.isEmpty()
			.jsonPath("$.events[1].city")
			.isEqualTo("Ho Chi Minh City");

		// A program saved before the rule holds an event in person without a city: it still saves its other fields
		// with that event as it stands, and is asked for the city once the event changes.
		jdbc.sql("""
				insert into program_event (program_id, position, title, starts_at, online)
				values (?::uuid, 2, 'Demo day', '2026-10-09T07:00:00Z', false)
				""").param(id).update();
		Map<String, Object> renamed = program(1, "Placed again", "placed");
		renamed.put("events", List.of(event("Webinar", true, null), event("Meetup", false, "Ho Chi Minh City"),
				event("Demo day", false, null)));
		save(operator, one, renamed).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.name")
			.isEqualTo("Placed again")
			.jsonPath("$.events[2].city")
			.isEmpty();

		Map<String, Object> changed = program(2, "Placed again", "placed");
		changed.put("events", List.of(event("Demo day and dinner", false, null)));
		assertProblem(save(operator, one, changed), 400, "PROGRAM_EVENT_CITY_REQUIRED");
	}

	@Test
	void anOperatorNamesTheDatesTheWindowPutsOnTheTimeline() {
		String one = created("Named dates", "named-dates");
		Map<String, Object> program = program(0, "Named dates", "named-dates");
		Map<String, Object> window = applications("2026-10-01T02:00:00Z", "2026-11-15T16:59:00Z", "2026-11-16");
		window.put("opensTitle", " Applications and the build period open ");
		window.put("closesTitle", "   ");
		window.put("outcomesTitle", "Finalists announced");
		program.put("applications", window);

		// A title is stripped, and a blank one is none: the date keeps its default words.
		save(operator, one, program).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.applications.opensTitle")
			.isEqualTo("Applications and the build period open")
			.jsonPath("$.applications.closesTitle")
			.isEmpty()
			.jsonPath("$.applications.outcomesTitle")
			.isEqualTo("Finalists announced");
		// The page reads the same titles; an operator reads a draft's page.
		get(operator, "/api/program/programs/named-dates").expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.applications.opensTitle")
			.isEqualTo("Applications and the build period open")
			.jsonPath("$.applications.closesTitle")
			.isEmpty();
		String list = new String(get(operator, PROGRAMS).expectBody().returnResult().getResponseBody(), UTF_8);
		assertThat(JsonPath.<List<String>>read(list,
				"$.items[?(@.slug == 'named-dates')].applications.outcomesTitle"))
			.containsExactly("Finalists announced");

		// A window sent without its titles has none, and a title longer than a key date's is pointed at.
		Map<String, Object> plain = program(1, "Named dates", "named-dates");
		plain.put("applications", applications("2026-10-01T02:00:00Z", "2026-11-15T16:59:00Z", "2026-11-16"));
		save(operator, one, plain).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.applications.opensTitle")
			.isEmpty()
			.jsonPath("$.applications.outcomesTitle")
			.isEmpty();
		Map<String, Object> wordy = program(2, "Named dates", "named-dates");
		Map<String, Object> tooLong = applications("2026-10-01T02:00:00Z", "2026-11-15T16:59:00Z", "2026-11-16");
		tooLong.put("closesTitle", "x".repeat(161));
		wordy.put("applications", tooLong);
		String body = new String(save(operator, one, wordy).expectStatus()
			.isBadRequest()
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8);
		assertThat(JsonPath.<List<String>>read(body, "$.errors[*].pointer"))
			.containsExactly("#/applications/closesTitle");
	}

	@Test
	void aSavedMemberThatIsNotValidIsPointedAt() {
		String one = created("Pointed", "pointed");
		Map<String, Object> program = program(0, "Pointed", "pointed");
		program.put("externalUrl", "genaifund.ai");
		program.put("applications", Map.of("opensAt", "2026-10-01T02:00:00Z", "shortlistSize", 0,
				"allowUpdatesUntilClose", true));
		program.put("keyDates", List.of(keyDate(" ", "2026-10-09T07:00:00Z", null, false)));
		program.put("events", List.of(Map.of("title", "Briefing", "startsAt", "2026-10-09T07:00:00Z", "online", true,
				"registrationUrl", "luma")));

		String body = new String(save(operator, one, program).expectStatus()
			.isBadRequest()
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8);

		assertThat(JsonPath.<String>read(body, "$.code")).isEqualTo("REQUEST_INVALID");
		assertThat(JsonPath.<List<String>>read(body, "$.errors[*].pointer")).containsExactlyInAnyOrder("#/externalUrl",
				"#/applications/closesAt", "#/applications/shortlistSize", "#/keyDates/0/title",
				"#/events/0/registrationUrl");
	}

	@Test
	void anAddressChangesUntilTheFirstPublication() {
		String one = created("Moving", "moving-from");
		created("Standing", "standing");

		save(operator, one, program(0, "Moving", "moving-to")).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.slug")
			.isEqualTo("moving-to");
		assertProblem(save(operator, one, program(1, "Moving", "standing")), 409, "PROGRAM_SLUG_TAKEN");

		jdbc.sql("update program set published_at = now() where slug = 'moving-to'").update();

		assertProblem(save(operator, one, program(1, "Moving", "moving-again")), 409, "PROGRAM_SLUG_FIXED");
		save(operator, one, program(1, "Moved", "moving-to")).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.slugFixed")
			.isEqualTo(true);
	}

	@Test
	void aCoverIsAStoredImageOfTheCallerAndAReplacedOneIsRemoved() {
		String one = created("Covered", "covered");
		String other = created("Covered too", "covered-too");
		UUID first = storedImage("operator@program.test");
		UUID second = storedImage("operator@program.test");
		TestSignIn.session(client, mail, "someone@program.test");

		Map<String, Object> program = program(0, "Covered", "covered");
		program.put("coverFileId", first);
		save(operator, one, program).expectStatus().isOk();
		// Saving again with the cover it has changes nothing about the file.
		program.put("version", 1);
		program.put("name", "Covered still");
		save(operator, one, program).expectStatus().isOk();
		assertThat(fileExists(first)).isTrue();

		for (UUID notUsable : List.of(UUID.randomUUID(), storedImage("someone@program.test"),
				file("operator@program.test", "program_image", "pending"),
				file("operator@program.test", "application_file", "stored"))) {
			program.put("version", 2);
			program.put("coverFileId", notUsable);
			assertProblem(save(operator, one, program), 400, "PROGRAM_COVER_NOT_USABLE");
		}
		Map<String, Object> borrowed = program(0, "Covered too", "covered-too");
		borrowed.put("coverFileId", first);
		assertProblem(save(operator, other, borrowed), 400, "PROGRAM_COVER_NOT_USABLE");

		program.put("coverFileId", second);
		save(operator, one, program).expectStatus().isOk();
		assertThat(fileExists(first)).isFalse();

		program.put("version", 3);
		program.put("coverFileId", null);
		save(operator, one, program).expectStatus().isOk().expectBody().jsonPath("$.coverFileId").isEmpty();
		assertThat(fileExists(second)).isFalse();
	}

	/** Creates a draft and returns the address it is read and saved at. */
	@Test
	void questionsAreKeptInOrderWithTheirIdentifiersUntilTheApplicationsOpen() {
		String uri = created("Asks", "asks");
		String questions = uri + "/questions";
		String empty = body(get(operator, questions).expectStatus().isOk());
		assertThat(JsonPath.<List<Object>>read(empty, "$.questions")).isEmpty();
		assertThat(JsonPath.<Boolean>read(empty, "$.fixed")).isFalse();
		assertProblem(get(TestSignIn.session(client, mail, "plain@asks.test"), questions), 403,
				"IDENTITY_OPERATOR_REQUIRED");

		String saved = body(save(operator, questions,
				Map.of("version", 0, "questions",
						List.of(question("long_text", "How does your solution address the challenge?", List.of()),
								question("single_choice", "Direction", List.of("Buying", " Claiming ", "Claiming")),
								question("confirm", "I've read the one hard constraint.", List.of()),
								question("multi_choice", "Challenge areas", List.of("Claims", " Pricing ", "Pricing")))))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<List<String>>read(saved, "$.questions[*].kind")).containsExactly("long_text",
				"single_choice", "confirm", "multi_choice");
		assertThat(JsonPath.<List<String>>read(saved, "$.questions[1].options")).containsExactly("Buying", "Claiming");
		assertThat(JsonPath.<List<String>>read(saved, "$.questions[3].options")).containsExactly("Claims", "Pricing");
		String direction = JsonPath.read(saved, "$.questions[1].id");
		int version = JsonPath.read(saved, "$.version");

		// An answer names its question, so a question moved or edited keeps its identifier.
		Map<String, Object> moved = question("single_choice", "Which direction?", List.of("Buying", "Carrying"));
		moved.put("id", direction);
		String reordered = body(save(operator, questions, Map.of("version", version, "questions", List.of(moved)))
			.expectStatus()
			.isOk());
		assertThat(JsonPath.<String>read(reordered, "$.questions[0].id")).isEqualTo(direction);
		assertProblem(save(operator, questions, Map.of("version", version, "questions", List.of())), 409,
				"PROGRAM_CHANGED_MEANWHILE");
		version = JsonPath.read(reordered, "$.version");
		assertProblem(save(operator, questions,
				Map.of("version", version, "questions", List.of(question("single_choice", "One way", List.of("Only"))))),
				400, "PROGRAM_CHOICES_REQUIRED");
		assertProblem(save(operator, questions, Map.of("version", version, "questions",
				List.of(question("multi_choice", "Any way", List.of("Only", " Only "))))), 400, "PROGRAM_CHOICES_REQUIRED");

		// Once the applications open, an answer may already name a question.
		Map<String, Object> open = program(version, "Asks", "asks");
		open.put("applications", applications("2026-01-01T00:00:00Z", "2099-01-01T00:00:00Z", "2099-01-10"));
		String opened = body(save(operator, uri, open).expectStatus().isOk());
		version = JsonPath.read(opened, "$.version");
		assertThat(JsonPath.<Integer>read(opened, "$.questionCount")).isEqualTo(1);
		assertThat(JsonPath.<Boolean>read(body(get(operator, questions).expectStatus().isOk()), "$.fixed")).isTrue();
		assertProblem(save(operator, questions, Map.of("version", version, "questions", List.of())), 409,
				"PROGRAM_QUESTIONS_FIXED");

		// Nor can the questions be freed by making the program look unopened again; when it closes still moves.
		Map<String, Object> later = program(version, "Asks", "asks");
		later.put("applications", applications("2099-01-01T00:00:00Z", "2099-02-01T00:00:00Z", "2099-02-10"));
		assertProblem(save(operator, uri, later), 409, "PROGRAM_OPENING_FIXED");
		assertProblem(save(operator, uri, program(version, "Asks", "asks")), 409, "PROGRAM_OPENING_FIXED");
		Map<String, Object> extended = program(version, "Asks", "asks");
		extended.put("applications", applications("2026-01-01T00:00:00Z", "2099-03-01T00:00:00Z", "2099-03-10"));
		version = JsonPath.read(body(save(operator, uri, extended).expectStatus().isOk()), "$.version");

		// The form names the opening to the minute: the same minute is the same opening, kept as it was.
		Map<String, Object> sameMinute = program(version, "Asks", "asks");
		sameMinute.put("applications", applications("2026-01-01T00:00:42Z", "2099-03-01T00:00:00Z", "2099-03-10"));
		assertThat(JsonPath.<String>read(body(save(operator, uri, sameMinute).expectStatus().isOk()),
				"$.applications.opensAt")).isEqualTo("2026-01-01T00:00:00Z");
	}

	private static Map<String, Object> question(String kind, String label, List<String> options) {
		Map<String, Object> question = new LinkedHashMap<>();
		question.put("kind", kind);
		question.put("label", label);
		question.put("required", true);
		question.put("options", options);
		return question;
	}

	private static String body(RestTestClient.ResponseSpec response) {
		return response.expectBody(String.class).returnResult().getResponseBody();
	}

	private String created(String name, String slug) {
		String body = create(operator, name, slug, "event").expectStatus()
			.isCreated()
			.expectBody(String.class)
			.returnResult()
			.getResponseBody();
		return PROGRAMS + "/" + JsonPath.<String>read(body, "$.id");
	}

	/** What the Settings screen sends for a program it has filled in nothing else of. */
	private static Map<String, Object> program(long version, String name, String slug) {
		Map<String, Object> program = new LinkedHashMap<>();
		program.put("version", version);
		program.put("name", name);
		program.put("slug", slug);
		program.put("type", "event");
		program.put("pageKind", "standard");
		program.put("keyDates", new ArrayList<>());
		program.put("events", new ArrayList<>());
		return program;
	}

	private static Map<String, Object> applications(String opensAt, String closesAt, String outcomesDueOn) {
		Map<String, Object> applications = new LinkedHashMap<>();
		applications.put("opensAt", opensAt);
		applications.put("closesAt", closesAt);
		applications.put("shortlistSize", 10);
		applications.put("outcomesDueOn", outcomesDueOn);
		applications.put("allowUpdatesUntilClose", true);
		return applications;
	}

	private static Map<String, Object> keyDate(String title, String startsAt, String endsAt, boolean allDay) {
		Map<String, Object> keyDate = new LinkedHashMap<>();
		keyDate.put("title", title);
		keyDate.put("startsAt", startsAt);
		keyDate.put("endsAt", endsAt);
		keyDate.put("allDay", allDay);
		return keyDate;
	}

	private static Map<String, Object> event(String title, boolean online, String city) {
		Map<String, Object> event = new LinkedHashMap<>();
		event.put("title", title);
		event.put("startsAt", "2026-10-09T07:00:00Z");
		event.put("online", online);
		event.put("city", city);
		return event;
	}

	private RestTestClient.ResponseSpec save(String session, String uri, Map<String, Object> program) {
		RestTestClient.RequestBodySpec request = client.put()
			.uri(uri)
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON);
		if (session != null) {
			request = request.cookie(TestSignIn.SESSION_COOKIE, session);
		}
		return request.body(program).exchange();
	}

	private UUID storedImage(String uploader) {
		return file(uploader, "program_image", "stored");
	}

	/** The record of a file as storage keeps it; the save reads the record, never the bytes. */
	private UUID file(String uploader, String purpose, String status) {
		UUID id = UUID.randomUUID();
		jdbc.sql("""
				insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type,
				                          size_bytes, status, uploaded_by_account_id, upload_expires_at)
				select ?, 'local', ?, ?, true, 'cover.png', 'image/png', 2048, ?, id, now()
				from identity_account where email = ?
				""").params(id, "test/" + id, purpose, status, uploader).update();
		return id;
	}

	private boolean fileExists(UUID id) {
		return jdbc.sql("select count(*) from storage_file where id = ?").param(id).query(Long.class).single() == 1;
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

	/**
	 * The test mailbox, imported through a class of this test's own so that the test keeps a Spring context, and with
	 * it a database, of its own.
	 */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

}
