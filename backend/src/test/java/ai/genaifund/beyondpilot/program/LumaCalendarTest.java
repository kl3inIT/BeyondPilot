package ai.genaifund.beyondpilot.program;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import ai.genaifund.beyondpilot.program.luma.LumaSignature;
import ai.genaifund.beyondpilot.program.persistence.LumaConnection;
import ai.genaifund.beyondpilot.program.persistence.LumaConnectionRepository;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterAll;
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

/**
 * The events of a Luma calendar coming onto the site through Luma's API (BEY-190, BEY-245), against PostgreSQL and a
 * stub of Luma that serves the API and the covers. The read is started by hand at a fixed moment: 14 October 2026,
 * 12:00 in Vietnam. The connection is written straight into the database, except where connecting is what is tested.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@luma.test")
@Import({ TestcontainersConfiguration.class, LumaCalendarTest.Mail.class })
class LumaCalendarTest {

	private static final Instant NOW = Instant.parse("2026-10-14T05:00:00Z");

	private static final String KEY = "not a real key 1234";

	private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0, 0, 0, 13 };

	private static final HttpServer LUMA = luma();

	/** What the stub answers, by path and, for the reads of events, the query that picks them. */
	private static final Map<String, Answer> ANSWERS = new ConcurrentHashMap<>();

	/** The requests Luma had, as {@code METHOD key}, and the bodies of those that carried one. */
	private static final List<String> ASKED = new CopyOnWriteArrayList<>();

	private static final List<String> BODIES = new CopyOnWriteArrayList<>();

	@Autowired
	private LumaCalendar calendar;

	@Autowired
	private LumaKeys keys;

	@Autowired
	private LumaConnectionRepository connections;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private TestMailbox mail;

	@LocalServerPort
	private int port;

	private record Answer(int status, String mediaType, byte[] body) {
	}

	@DynamicPropertySource
	static void luma(DynamicPropertyRegistry registry) {
		registry.add("beyondpilot.program.luma.api", LumaCalendarTest::base);
		registry.add("beyondpilot.program.luma.hosts", () -> "127.0.0.1");
		registry.add("beyondpilot.program.luma.site-url", () -> "https://beyondpilot.test");
		registry.add("beyondpilot.program.luma.encryption-key",
				() -> Base64.getEncoder().encodeToString(new byte[32]));
	}

	@BeforeEach
	void clear() {
		jdbc.sql("delete from program where luma_event_id is not null or slug like 'luma-test-%'").update();
		jdbc.sql("delete from program_luma_connection").update();
		ANSWERS.clear();
		ASKED.clear();
		BODIES.clear();
	}

	@AfterAll
	static void stop() {
		LUMA.stop(0);
	}

	@Test
	void anEventToComeBecomesAPublishedProgramWithItsCoverDaysAndEvent() {
		connected();
		calendarOf(event("evt-past", "Past meetup", "2026-06-20T06:30:00Z", "past-meetup", "/past.png", "public"),
				event("evt-dinner", "TinyFish, Big Minds", "2026-10-26T11:00:00Z", "gaf-tinyfish-vn", "/dinner.png",
						"public"));
		image("/dinner.png");

		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(1, 0, 0, 0, LumaCalendar.Outcome.READ));

		Map<String, Object> program = program("evt-dinner");
		assertThat(program).containsEntry("slug", "tinyfish-big-minds")
			.containsEntry("name", "TinyFish, Big Minds")
			.containsEntry("type", "event")
			.containsEntry("status", "published")
			.containsEntry("page_kind", "external")
			.containsEntry("external_url", "https://luma.com/gaf-tinyfish-vn")
			.containsEntry("summary", "A private dinner with TinyFish's leadership.")
			.containsEntry("about", "A private dinner with TinyFish's leadership.\nIn Ho Chi Minh City.")
			.containsEntry("luma_cover_url", base() + "/dinner.png");
		assertThat(program.get("starts_on")).hasToString("2026-10-26");
		assertThat(program.get("ends_on")).hasToString("2026-10-26");
		UUID cover = (UUID) program.get("cover_file_id");
		assertThat(jdbc.sql("select purpose, media_type, uploaded_by_account_id, status from storage_file where id = ?")
			.param(cover)
			.query()
			.singleRow()).containsEntry("purpose", "program_image")
			.containsEntry("media_type", "image/png")
			.containsEntry("uploaded_by_account_id", null)
			.containsEntry("status", "stored");
		assertThat(jdbc.sql("""
				select title, starts_at, ends_at, online, city, country, registration_url
				from program_event where program_id = ?""").param(program.get("id")).query().singleRow())
			.containsEntry("title", "TinyFish, Big Minds")
			.containsEntry("online", false)
			.containsEntry("city", "Thành phố Hồ Chí Minh")
			.containsEntry("country", "Vietnam")
			.containsEntry("registration_url", "https://luma.com/gaf-tinyfish-vn");
		// The past event is not read in full, nor its cover; every call carries the key.
		assertThat(ASKED).containsExactly("GET /v1/calendars/events/list?access=manage",
				"GET /v1/calendars/events/list?access=view", "GET /v1/events/get?event_id=evt-dinner", "GET /dinner.png");
		assertThat(jdbc.sql("""
				select action, actor_id from audit_event
				where resource_type = 'program' and resource_id = ? order by occurred_at, action""")
			.param(program.get("id").toString())
			.query((row, index) -> row.getString("action") + " " + row.getString("actor_id"))
			.list()).containsExactlyInAnyOrder("program.create null", "program.publish null");
		assertThat(connections.current().orElseThrow().getLastReadAt()).isEqualTo(NOW);
	}

	@Test
	void aPrivateEventWaitsAsADraftAndOneAnotherHostListsIsBroughtToo() {
		connected();
		calendarOf(event("evt-briefing", "Briefing Day", "2026-11-11T02:00:00Z", "briefing", "/briefing.png",
				"private"));
		listedOf(event("evt-cowork", "Cowork & Showcase", "2026-10-20T10:00:00Z", "oawz935f", "/cowork.png", "public"));
		image("/briefing.png");
		image("/cowork.png");

		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(2, 0, 0, 0, LumaCalendar.Outcome.READ));

		assertThat(program("evt-briefing")).containsEntry("status", "draft");
		assertThat(program("evt-cowork")).containsEntry("status", "published");
	}

	@Test
	void anOnlineEventHasNoCityAndItsDaysAreThoseOfItsTimeZone() {
		connected();
		// 23:30 on 10 November in Vietnam is still 10 November there, though 16:30 UTC.
		calendarOf();
		ANSWERS.put("GET /v1/calendars/events/list?access=manage", json(list("""
				{"id":"evt-call","name":"Tasco briefing","start_at":"2026-11-10T16:30:00.000Z",
				"end_at":"2026-11-10T17:30:00.000Z","timezone":"Asia/Ho_Chi_Minh","location_type":"zoom",
				"geo_address_json":null,"url":"https://luma.com/tasco-briefing","visibility":"public","access":"manage",
				"cover_url":"%s/call.png"}""".formatted(base()))));
		image("/call.png");

		calendar.read(NOW);

		Map<String, Object> program = program("evt-call");
		assertThat(program.get("starts_on")).hasToString("2026-11-10");
		assertThat(jdbc.sql("select online, city, country from program_event where program_id = ?")
			.param(program.get("id"))
			.query()
			.singleRow()).containsEntry("online", true).containsEntry("city", null).containsEntry("country", null);
	}

	@Test
	void aReadThatFindsNothingNewWritesNothing() {
		connected();
		calendarOf(event("evt-dinner", "TinyFish, Big Minds", "2026-10-26T11:00:00Z", "gaf-tinyfish-vn",
				"/dinner.png", "public"));
		image("/dinner.png");
		calendar.read(NOW);
		Map<String, Object> first = program("evt-dinner");
		ASKED.clear();

		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(0, 0, 0, 0, LumaCalendar.Outcome.READ));

		Map<String, Object> second = program("evt-dinner");
		assertThat(second.get("version")).isEqualTo(first.get("version"));
		assertThat(second.get("updated_at")).isEqualTo(first.get("updated_at"));
		// The cover is downloaded once.
		assertThat(ASKED).doesNotContain("GET /dinner.png");
	}

	@Test
	void aChangeOnLumaOverwritesTheProgramAndAReplacedCoverGoes() {
		connected();
		calendarOf(event("evt-dinner", "TinyFish, Big Minds", "2026-10-26T11:00:00Z", "gaf-tinyfish-vn",
				"/dinner.png", "public"));
		image("/dinner.png");
		calendar.read(NOW);
		UUID oldCover = (UUID) program("evt-dinner").get("cover_file_id");
		jdbc.sql("update program set name = 'Typed by an operator' where luma_event_id = 'evt-dinner'").update();

		calendarOf(event("evt-dinner", "TinyFish, Bigger Minds", "2026-10-27T12:00:00Z", "gaf-tinyfish-vn",
				"/dinner-2.png", "public"));
		image("/dinner-2.png");
		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(0, 1, 0, 0, LumaCalendar.Outcome.READ));

		Map<String, Object> program = program("evt-dinner");
		assertThat(program).containsEntry("name", "TinyFish, Bigger Minds")
			.containsEntry("status", "published")
			.containsEntry("luma_cover_url", base() + "/dinner-2.png");
		assertThat(program.get("starts_on")).hasToString("2026-10-27");
		assertThat(program.get("cover_file_id")).isNotEqualTo(oldCover);
		assertThat(jdbc.sql("select count(*) from storage_file where id = ?").param(oldCover).query(Long.class).single())
			.isZero();
		assertThat(jdbc.sql("select starts_at from program_event where program_id = ?")
			.param(program.get("id"))
			.query(Timestamp.class)
			.single()
			.toInstant()).isEqualTo(Instant.parse("2026-10-27T12:00:00Z"));
	}

	@Test
	void aProgramAnOperatorUnpublishedStaysUnpublished() {
		connected();
		calendarOf(event("evt-dinner", "TinyFish, Big Minds", "2026-10-26T11:00:00Z", "gaf-tinyfish-vn",
				"/dinner.png", "public"));
		image("/dinner.png");
		calendar.read(NOW);
		jdbc.sql("update program set status = 'draft' where luma_event_id = 'evt-dinner'").update();

		calendarOf(event("evt-dinner", "TinyFish, Big Minds", "2026-10-26T12:00:00Z", "gaf-tinyfish-vn",
				"/dinner.png", "public"));
		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(0, 1, 0, 0, LumaCalendar.Outcome.READ));

		assertThat(program("evt-dinner")).containsEntry("status", "draft");
	}

	@Test
	void aCoverThatCannotBeKeptLeavesThePageWithoutItAndIsTriedAgain() {
		connected();
		// Luma's default cover may be a GIF, which storage does not keep: the page is made all the same.
		calendarOf(event("evt-gif", "Builders night", "2026-11-19T10:00:00Z", "builders-night", "/cover.gif",
				"public"));
		ANSWERS.put("GET /cover.gif", new Answer(200, "image/gif", PNG));
		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(1, 0, 0, 0, LumaCalendar.Outcome.READ));
		Map<String, Object> program = program("evt-gif");
		assertThat(program).containsEntry("status", "draft")
			.containsEntry("cover_file_id", null)
			.containsEntry("luma_cover_url", null)
			.containsEntry("name", "Builders night");

		// One Luma cannot serve now is tried again at each read, and nothing fails.
		ANSWERS.put("GET /cover.gif", new Answer(404, "application/json", "{}".getBytes(UTF_8)));
		assertThat(calendar.read(NOW).failed()).isZero();
		assertThat(program("evt-gif")).containsEntry("cover_file_id", null);

		// A cover storage keeps is taken, and the public event's page, now complete, goes public.
		calendarOf(event("evt-gif", "Builders night", "2026-11-19T10:00:00Z", "builders-night", "/cover.png",
				"public"));
		image("/cover.png");
		calendar.read(NOW);
		assertThat(program("evt-gif")).containsEntry("status", "published")
			.containsEntry("luma_cover_url", base() + "/cover.png");
		assertThat(program("evt-gif").get("cover_file_id")).isNotNull();
	}

	@Test
	void anEventMadePublicOnLumaGoesPublicHereOnceAndItsAddressIsItsName() {
		connected();
		calendarOf(event("evt-meetup", "GenAI Builders Meetup Singapore", "2026-11-19T10:00:00Z", "f2jpv3fl",
				"/meetup.png", "private"));
		image("/meetup.png");
		calendar.read(NOW);
		assertThat(program("evt-meetup")).containsEntry("status", "draft")
			.containsEntry("slug", "genai-builders-meetup-singapore");

		// Nothing else changed on Luma: the page is published, and no update is recorded.
		calendarOf(event("evt-meetup", "GenAI Builders Meetup Singapore", "2026-11-19T10:00:00Z", "f2jpv3fl",
				"/meetup.png", "public"));
		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(0, 1, 0, 0, LumaCalendar.Outcome.READ));
		Map<String, Object> program = program("evt-meetup");
		assertThat(program).containsEntry("status", "published");
		assertThat(jdbc.sql("select action from audit_event where resource_type = 'program' and resource_id = ?")
			.param(program.get("id").toString())
			.query(String.class)
			.list()).containsExactlyInAnyOrder("program.create", "program.publish");

		// Kept from the public on Luma again, then public again: an operator decides from then on.
		jdbc.sql("update program set status = 'draft' where luma_event_id = 'evt-meetup'").update();
		assertThat(calendar.read(NOW).updated()).isZero();
		assertThat(program("evt-meetup")).containsEntry("status", "draft");
	}

	@Test
	void anEventToComeThatLeftTheCalendarIsUnpublished() {
		connected();
		calendarOf(event("evt-dinner", "TinyFish, Big Minds", "2026-10-26T11:00:00Z", "gaf-tinyfish-vn",
				"/dinner.png", "public"),
				event("evt-talk", "Office hours", "2026-11-02T02:00:00Z", "office-hours", "/talk.png", "public"));
		image("/dinner.png");
		image("/talk.png");
		calendar.read(NOW);

		calendarOf(event("evt-talk", "Office hours", "2026-11-02T02:00:00Z", "office-hours", "/talk.png", "public"));
		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(0, 0, 1, 0, LumaCalendar.Outcome.READ));

		assertThat(program("evt-dinner")).containsEntry("status", "draft");
		assertThat(program("evt-talk")).containsEntry("status", "published");
	}

	@Test
	void aCalendarThatCannotBeReadChangesNothingAndSaysWhy() {
		assertThat(calendar.read(NOW)).isEqualTo(LumaCalendar.Read.not(LumaCalendar.Outcome.NOT_CONNECTED));
		assertThat(ASKED).isEmpty();

		connected();
		calendarOf(event("evt-dinner", "TinyFish, Big Minds", "2026-10-26T11:00:00Z", "gaf-tinyfish-vn",
				"/dinner.png", "public"));
		image("/dinner.png");
		calendar.read(NOW);

		ANSWERS.put("GET /v1/calendars/events/list?access=manage",
				new Answer(429, "application/json", "{\"message\":\"rate limit\"}".getBytes(UTF_8)));
		assertThat(calendar.read(NOW)).isEqualTo(LumaCalendar.Read.not(LumaCalendar.Outcome.UNREACHABLE));
		assertThat(connections.current().orElseThrow().getLastReadError()).isEqualTo("Luma could not be read");
		assertThat(connections.current().orElseThrow().getLastReadAt()).isEqualTo(NOW);

		ANSWERS.put("GET /v1/calendars/events/list?access=manage",
				new Answer(401, "application/json", "{\"message\":\"Invalid API key\"}".getBytes(UTF_8)));
		assertThat(calendar.read(NOW)).isEqualTo(LumaCalendar.Read.not(LumaCalendar.Outcome.KEY_REFUSED));
		assertThat(connections.current().orElseThrow().getLastReadError()).isEqualTo("Luma refused the key");

		assertThat(program("evt-dinner")).containsEntry("status", "published");
	}

	@Test
	void anEventThatFailsLeavesTheOthersDoneAndOneWithoutACoverWaitsAsADraft() {
		connected();
		jdbc.sql("""
				insert into program (id, slug, name, type, status, page_kind, version, created_at, updated_at)
				values (gen_random_uuid(), 'luma-test-taken', 'Taken', 'event', 'draft', 'standard', 0, now(), now())""")
			.update();
		// The first's cover is on a host the job may not call; the second has none; Luma fails to give the third.
		calendarOf();
		ANSWERS.put("GET /v1/calendars/events/list?access=manage", json(list(
				eventJson("evt-elsewhere", "Elsewhere", "2026-10-26T11:00:00Z", "elsewhere",
						"http://localhost:" + LUMA.getAddress().getPort() + "/x.png", "public"),
				eventJson("evt-bare", "Luma test taken", "2026-10-28T11:00:00Z", "bare", null, "public"),
				eventJson("evt-broken", "Broken", "2026-10-29T11:00:00Z", "broken", null, "public"))));
		ANSWERS.put("GET /v1/events/get?event_id=evt-broken", new Answer(500, "application/json", "{}".getBytes(UTF_8)));

		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(2, 0, 0, 1, LumaCalendar.Outcome.READ));

		assertThat(program("evt-bare")).containsEntry("slug", "luma-test-taken-2")
			.containsEntry("status", "draft")
			.containsEntry("cover_file_id", null);
		// A cover the job may not fetch leaves its page without one, and the host is never called.
		assertThat(program("evt-elsewhere")).containsEntry("status", "draft").containsEntry("cover_file_id", null);
		assertThat(ASKED).doesNotContain("GET /x.png");
		assertThat(jdbc.sql("select count(*) from program where luma_event_id = 'evt-broken'")
			.query(Long.class)
			.single()).isZero();
	}

	@Test
	void anOperatorConnectsTheCalendarWhichMakesItsWebhookAndIsRead() {
		RestTestClient client = client();
		String operator = TestSignIn.session(client, mail, "operator@luma.test");
		String user = TestSignIn.session(client, mail, "plain@luma.test");
		ANSWERS.put("GET /v1/calendars/get", json("{\"id\":\"cal-gaf\",\"name\":\"GenAI Fund - Official\"}"));
		// A webhook a connection before left at this address, and one of somebody else's.
		ANSWERS.put("GET /v1/webhooks/list", json("""
				{"entries":[{"id":"wh-old","url":"https://beyondpilot.test/api/program/luma/webhook"},
				{"id":"wh-other","url":"https://example.com/luma"}],"has_more":false}"""));
		ANSWERS.put("POST /v1/webhooks/delete", json("{}"));
		ANSWERS.put("POST /v2/webhooks/create", json("""
				{"id":"wh-new","url":"https://beyondpilot.test/api/program/luma/webhook","status":"active",
				"secret":"whsec_test"}"""));
		calendarOf();

		connect(client, user, KEY).expectStatus().isForbidden();
		connect(client, operator, KEY).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.encryptionReady")
			.isEqualTo(true)
			.jsonPath("$.calendar.id")
			.isEqualTo("cal-gaf")
			.jsonPath("$.calendar.name")
			.isEqualTo("GenAI Fund - Official")
			.jsonPath("$.calendar.keyEnding")
			.isEqualTo("1234")
			.jsonPath("$.calendar.webhook")
			.isEqualTo(true);

		assertThat(BODIES).contains("POST /v1/webhooks/delete {\"id\":\"wh-old\"}").noneMatch(body -> body.contains("wh-other"));
		assertThat(BODIES).anyMatch(body -> body.startsWith("POST /v2/webhooks/create")
				&& body.contains("\"url\":\"https://beyondpilot.test/api/program/luma/webhook\"")
				&& body.contains("event.updated"));
		LumaConnection held = connections.current().orElseThrow();
		assertThat(held.getApiKey()).isNotEqualTo(KEY.getBytes(UTF_8));
		assertThat(keys.open(held.getApiKey())).isEqualTo(KEY);
		assertThat(keys.open(held.getWebhookSecret())).isEqualTo("whsec_test");
		// The calendar is read soon after.
		await().atMost(Duration.ofSeconds(10))
			.until(() -> ASKED.contains("GET /v1/calendars/events/list?access=manage"));
		assertThat(jdbc.sql("""
				select actor_email, details from audit_event where action = 'program.luma_connect'
				order by occurred_at desc limit 1""").query().singleRow())
			.containsEntry("actor_email", "operator@luma.test");
		client.get()
			.uri("/api/program/admin/luma")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.calendar.webhook")
			.isEqualTo(true)
			.jsonPath("$.calendar.apiKey")
			.doesNotExist();

		client.delete()
			.uri("/api/program/admin/luma")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, operator)
			.exchange()
			.expectStatus()
			.isNoContent();
		assertThat(BODIES).contains("POST /v1/webhooks/delete {\"id\":\"wh-new\"}");
		assertThat(connections.current()).isEmpty();
	}

	@Test
	void aKeyLumaRefusesIsNotKeptAndAWebhookThatCannotBeMadeIsSaid() {
		RestTestClient client = client();
		String operator = TestSignIn.session(client, mail, "operator@luma.test");
		ANSWERS.put("GET /v1/calendars/get", new Answer(401, "application/json", "{}".getBytes(UTF_8)));

		connect(client, operator, "wrong").expectStatus()
			.isBadRequest()
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo("PROGRAM_LUMA_KEY_REFUSED");
		assertThat(connections.current()).isEmpty();

		ANSWERS.put("GET /v1/calendars/get", json("{\"id\":\"cal-gaf\",\"name\":\"GenAI Fund - Official\"}"));
		ANSWERS.put("GET /v1/webhooks/list", json("{\"entries\":[],\"has_more\":false}"));
		ANSWERS.put("POST /v2/webhooks/create", new Answer(400, "application/json", "{}".getBytes(UTF_8)));
		calendarOf();
		connect(client, operator, KEY).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.calendar.webhook")
			.isEqualTo(false)
			.jsonPath("$.calendar.webhookError")
			.isEqualTo("Luma did not make the webhook for https://beyondpilot.test/api/program/luma/webhook");
	}

	@Test
	void aSignedDeliveryMakesTheCalendarBeReadAndAnUnsignedOneIsRefused() {
		connected();
		calendarOf();
		RestTestClient client = client();
		byte[] body = "{\"type\":\"event.updated\",\"data\":{\"id\":\"evt-dinner\"}}".getBytes(UTF_8);
		long now = Instant.now().getEpochSecond();

		deliver(client, body, null).expectStatus().isForbidden();
		deliver(client, body, "t=" + now + ",v1=" + HexFormat.of().formatHex(LumaSignature.sign("other", now, body)))
			.expectStatus()
			.isForbidden();
		assertThat(ASKED).isEmpty();

		deliver(client, body, "t=" + now + ",v1=" + HexFormat.of().formatHex(LumaSignature.sign("whsec_test", now, body)))
			.expectStatus()
			.isNoContent();
		await().atMost(Duration.ofSeconds(10))
			.until(() -> ASKED.contains("GET /v1/calendars/events/list?access=manage"));
	}

	@Test
	void anOperatorReadsTheCalendarNowAndTheReadIsRecorded() {
		RestTestClient client = client();
		String operator = TestSignIn.session(client, mail, "operator@luma.test");
		String user = TestSignIn.session(client, mail, "plain@luma.test");
		readNow(client, operator).expectStatus()
			.isEqualTo(503)
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo("PROGRAM_LUMA_NOT_CONFIGURED");
		connected();
		// Read at the real moment, so the event is set far ahead.
		calendarOf(event("evt-dinner", "TinyFish, Big Minds", "2099-10-26T11:00:00Z", "gaf-tinyfish-vn",
				"/dinner.png", "public"));
		image("/dinner.png");

		readNow(client, user).expectStatus().isForbidden();
		readNow(client, operator).expectStatus()
			.isOk()
			.expectBody()
			.json("{\"created\":1,\"updated\":0,\"unpublished\":0,\"failed\":0}");

		assertThat(program("evt-dinner")).containsEntry("status", "published");
		assertThat(jdbc.sql("""
				select actor_email, resource_label from audit_event where action = 'program.luma_read'
				order by occurred_at desc limit 1""").query().singleRow())
			.containsEntry("actor_email", "operator@luma.test")
			.containsEntry("resource_label", "GenAI Fund - Official");

		ANSWERS.put("GET /v1/calendars/events/list?access=manage",
				new Answer(503, "text/plain", "Busy".getBytes(UTF_8)));
		readNow(client, operator).expectStatus()
			.isEqualTo(503)
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo("PROGRAM_LUMA_UNREACHABLE");
	}

	/** The calendar connected with {@link #KEY} and a webhook whose secret is {@code whsec_test}. */
	private void connected() {
		LumaConnection connection = new LumaConnection(keys.seal(KEY), "1234", "cal-gaf", "GenAI Fund - Official",
				null, Instant.now());
		connection.hooked("wh-test", keys.seal("whsec_test"), Instant.now());
		connections.saveAndFlush(connection);
	}

	private RestTestClient client() {
		return RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
	}

	private static RestTestClient.ResponseSpec connect(RestTestClient client, String session, String key) {
		return client.put()
			.uri("/api/program/admin/luma")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("apiKey", key))
			.exchange();
	}

	private static RestTestClient.ResponseSpec readNow(RestTestClient client, String session) {
		return client.post()
			.uri("/api/program/admin/luma/read")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange();
	}

	/** A delivery as Luma posts it: no session and no CSRF header. */
	private static RestTestClient.ResponseSpec deliver(RestTestClient client, byte[] body, @Nullable String signature) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri("/api/program/luma/webhook")
			.contentType(MediaType.APPLICATION_JSON);
		if (signature != null) {
			request.header("Webhook-Signature", signature);
		}
		return request.body(body).exchange();
	}

	private Map<String, Object> program(String eventId) {
		return jdbc.sql("select * from program where luma_event_id = ?").param(eventId).query().singleRow();
	}

	/** The test mailbox, through a class of this test's own, as {@code ProgramAdministrationTest} imports it. */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

	/** An event of the calendar: in the list without its description, and in full when read alone. */
	private record Event(String id, String listed, String full) {
	}

	private static Event event(String id, String name, String startsAt, String path, String cover, String visibility) {
		String listed = eventJson(id, name, startsAt, path, base() + cover, visibility);
		String full = listed.substring(0, listed.length() - 1)
				+ ",\"description\":\"A private dinner with TinyFish's leadership.\\nIn Ho Chi Minh City.\"}";
		return new Event(id, listed, full);
	}

	private static String eventJson(String id, String name, String startsAt, String path, @Nullable String cover,
			String visibility) {
		Instant start = Instant.parse(startsAt);
		return """
				{"id":"%s","name":"%s","start_at":"%s","end_at":"%s","timezone":"Asia/Ho_Chi_Minh",
				"location_type":"offline","geo_address_json":{"city":"Thành phố Hồ Chí Minh","country":"VN",
				"full_address":"24 Nguyễn Thị Nghĩa, Quận 1"},"url":"https://luma.com/%s","visibility":"%s",
				"access":"manage"%s}""".formatted(id, name, start, start.plus(Duration.ofHours(2)), path, visibility,
				cover == null ? "" : ",\"cover_url\":\"" + cover + "\"");
	}

	private static void calendarOf(Event... events) {
		ANSWERS.put("GET /v1/calendars/events/list?access=manage",
				json(list(java.util.Arrays.stream(events).map(Event::listed).toArray(String[]::new))));
		ANSWERS.putIfAbsent("GET /v1/calendars/events/list?access=view", json(list()));
		for (Event event : events) {
			ANSWERS.put("GET /v1/events/get?event_id=" + event.id(), json(event.full()));
		}
	}

	private static void listedOf(Event... events) {
		ANSWERS.put("GET /v1/calendars/events/list?access=view", json(list(
				java.util.Arrays.stream(events).map(event -> event.listed().replace("\"manage\"", "\"view\"")).toArray(String[]::new))));
		for (Event event : events) {
			ANSWERS.put("GET /v1/events/get?event_id=" + event.id(), json(event.full().replace("\"manage\"", "\"view\"")));
		}
	}

	private static String list(String... events) {
		return "{\"entries\":[" + String.join(",", events) + "],\"has_more\":false}";
	}

	private static Answer json(String json) {
		return new Answer(200, "application/json", json.getBytes(UTF_8));
	}

	private static void image(String path) {
		ANSWERS.put("GET " + path, new Answer(200, "image/png", PNG));
	}

	private static String base() {
		return "http://127.0.0.1:" + LUMA.getAddress().getPort();
	}

	private static HttpServer luma() {
		try {
			HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			server.createContext("/", LumaCalendarTest::answer);
			server.start();
			return server;
		}
		catch (IOException failed) {
			throw new UncheckedIOException(failed);
		}
	}

	/** Answers by method, path and the query that picks events; the API refuses a call without the key. */
	private static void answer(HttpExchange exchange) throws IOException {
		String path = exchange.getRequestURI().getPath();
		String query = exchange.getRequestURI().getQuery();
		String picked = "";
		if (query != null) {
			for (String pair : query.split("&")) {
				if (pair.startsWith("access=") || pair.startsWith("event_id=")) {
					picked = "?" + pair;
				}
			}
		}
		String asked = exchange.getRequestMethod() + " " + path + picked;
		ASKED.add(asked);
		try (InputStream body = exchange.getRequestBody()) {
			byte[] sent = body.readAllBytes();
			if (sent.length > 0) {
				BODIES.add(asked + " " + new String(sent, UTF_8));
			}
			boolean api = path.startsWith("/v1/") || path.startsWith("/v2/");
			String key = exchange.getRequestHeaders().getFirst("x-luma-api-key");
			Answer answer = api && key == null ? new Answer(401, "application/json", "{}".getBytes(UTF_8))
					: ANSWERS.getOrDefault(asked, new Answer(404, "text/plain", "Not found".getBytes(UTF_8)));
			exchange.getResponseHeaders().set("Content-Type", answer.mediaType());
			exchange.sendResponseHeaders(answer.status(), answer.body().length);
			exchange.getResponseBody().write(answer.body());
		}
		finally {
			exchange.close();
		}
	}

}
