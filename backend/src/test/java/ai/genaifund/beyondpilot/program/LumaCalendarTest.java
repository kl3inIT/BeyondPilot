package ai.genaifund.beyondpilot.program;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * The events of a Luma calendar coming onto the site, against PostgreSQL and a stub of Luma that serves the calendar,
 * the event pages and their images. The read is started by hand at a fixed moment: 14 October 2026, 12:00 in Vietnam.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class LumaCalendarTest {

	private static final Instant NOW = Instant.parse("2026-10-14T05:00:00Z");

	private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0, 0, 0, 13 };

	private static final HttpServer LUMA = luma();

	/** What the stub answers, by path; a path it does not know answers 404. */
	private static final Map<String, Answer> ANSWERS = new ConcurrentHashMap<>();

	/** The paths Luma was asked for. */
	private static final List<String> ASKED = new CopyOnWriteArrayList<>();

	@Autowired
	private LumaCalendar calendar;

	@Autowired
	private JdbcClient jdbc;

	private record Answer(int status, String mediaType, byte[] body) {
	}

	@DynamicPropertySource
	static void luma(DynamicPropertyRegistry registry) {
		registry.add("beyondpilot.program.luma.feed", () -> base() + "/ics");
		registry.add("beyondpilot.program.luma.hosts", () -> "127.0.0.1");
	}

	@BeforeEach
	void clear() {
		jdbc.sql("delete from program where luma_event_id is not null or slug like 'luma-test-%'").update();
		ANSWERS.clear();
		ASKED.clear();
	}

	@AfterAll
	static void stop() {
		LUMA.stop(0);
	}

	@Test
	void anEventToComeBecomesAPublishedProgramWithItsCoverDaysAndEvent() {
		calendarOf(event("evt-past", "20260620T063000Z", "past-meetup"), event("evt-dinner", "20261026T110000Z",
				"gaf-tinyfish-vn"));
		page("past-meetup", "Past meetup", "2026-06-20T13:30:00.000+07:00", "/past.png");
		page("gaf-tinyfish-vn", "TinyFish, Big Minds", "2026-10-26T18:00:00.000+07:00", "/dinner.png");
		image("/dinner.png");

		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(1, 0, 0, 0));

		Map<String, Object> program = program("evt-dinner");
		assertThat(program).containsEntry("slug", "gaf-tinyfish-vn")
			.containsEntry("name", "TinyFish, Big Minds")
			.containsEntry("type", "event")
			.containsEntry("status", "published")
			.containsEntry("page_kind", "external")
			.containsEntry("external_url", base() + "/gaf-tinyfish-vn")
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
			.containsEntry("registration_url", base() + "/gaf-tinyfish-vn");
		// The past event is not read, nor its page.
		assertThat(ASKED).containsExactly("/ics", "/gaf-tinyfish-vn", "/dinner.png");
		assertThat(jdbc.sql("""
				select action, actor_id from audit_event
				where resource_type = 'program' and resource_id = ? order by occurred_at, action""")
			.param(program.get("id").toString())
			.query((row, index) -> row.getString("action") + " " + row.getString("actor_id"))
			.list()).containsExactlyInAnyOrder("program.create null", "program.publish null");
	}

	@Test
	void aReadThatFindsNothingNewWritesNothing() {
		calendarOf(event("evt-dinner", "20261026T110000Z", "gaf-tinyfish-vn"));
		page("gaf-tinyfish-vn", "TinyFish, Big Minds", "2026-10-26T18:00:00.000+07:00", "/dinner.png");
		image("/dinner.png");
		calendar.read(NOW);
		Map<String, Object> first = program("evt-dinner");
		ASKED.clear();

		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(0, 0, 0, 0));

		Map<String, Object> second = program("evt-dinner");
		assertThat(second.get("version")).isEqualTo(first.get("version"));
		assertThat(second.get("updated_at")).isEqualTo(first.get("updated_at"));
		// The cover is downloaded once.
		assertThat(ASKED).containsExactly("/ics", "/gaf-tinyfish-vn");
	}

	@Test
	void aChangeOnLumaOverwritesTheProgramAndAReplacedCoverGoes() {
		calendarOf(event("evt-dinner", "20261026T110000Z", "gaf-tinyfish-vn"));
		page("gaf-tinyfish-vn", "TinyFish, Big Minds", "2026-10-26T18:00:00.000+07:00", "/dinner.png");
		image("/dinner.png");
		calendar.read(NOW);
		UUID oldCover = (UUID) program("evt-dinner").get("cover_file_id");
		jdbc.sql("update program set name = 'Typed by an operator' where luma_event_id = 'evt-dinner'").update();

		page("gaf-tinyfish-vn", "TinyFish, Bigger Minds", "2026-10-27T19:00:00.000+07:00", "/dinner-2.png");
		image("/dinner-2.png");
		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(0, 1, 0, 0));

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
		calendarOf(event("evt-dinner", "20261026T110000Z", "gaf-tinyfish-vn"));
		page("gaf-tinyfish-vn", "TinyFish, Big Minds", "2026-10-26T18:00:00.000+07:00", "/dinner.png");
		image("/dinner.png");
		calendar.read(NOW);
		jdbc.sql("update program set status = 'draft' where luma_event_id = 'evt-dinner'").update();

		page("gaf-tinyfish-vn", "TinyFish, Big Minds", "2026-10-26T19:00:00.000+07:00", "/dinner.png");
		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(0, 1, 0, 0));

		assertThat(program("evt-dinner")).containsEntry("status", "draft");
	}

	@Test
	void anEventToComeThatLeftTheCalendarIsUnpublished() {
		calendarOf(event("evt-dinner", "20261026T110000Z", "gaf-tinyfish-vn"),
				event("evt-talk", "20261102T020000Z", "office-hours"));
		page("gaf-tinyfish-vn", "TinyFish, Big Minds", "2026-10-26T18:00:00.000+07:00", "/dinner.png");
		page("office-hours", "Office hours", "2026-11-02T09:00:00.000+07:00", "/talk.png");
		image("/dinner.png");
		image("/talk.png");
		calendar.read(NOW);

		calendarOf(event("evt-talk", "20261102T020000Z", "office-hours"));
		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(0, 0, 1, 0));

		assertThat(program("evt-dinner")).containsEntry("status", "draft");
		assertThat(program("evt-talk")).containsEntry("status", "published");
	}

	@Test
	void aCalendarThatCannotBeReadChangesNothing() {
		calendarOf(event("evt-dinner", "20261026T110000Z", "gaf-tinyfish-vn"));
		page("gaf-tinyfish-vn", "TinyFish, Big Minds", "2026-10-26T18:00:00.000+07:00", "/dinner.png");
		image("/dinner.png");
		calendar.read(NOW);

		ANSWERS.put("/ics", new Answer(429, "application/json", "{\"message\":\"rate limit\"}".getBytes(UTF_8)));
		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(0, 0, 0, 0));
		ANSWERS.put("/ics", new Answer(200, "text/html", "<html>Not a calendar</html>".getBytes(UTF_8)));
		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(0, 0, 0, 0));

		assertThat(program("evt-dinner")).containsEntry("status", "published");
	}

	@Test
	void anEventThatFailsLeavesTheOthersDoneAndOneWithoutACoverWaitsAsADraft() {
		jdbc.sql("""
				insert into program (id, slug, name, type, status, page_kind, version, created_at, updated_at)
				values (gen_random_uuid(), 'luma-test-taken', 'Taken', 'event', 'draft', 'standard', 0, now(), now())""")
			.update();
		calendarOf(event("evt-broken", "20261026T110000Z", "broken"),
				event("evt-elsewhere", "20261026T110000Z", "elsewhere"),
				event("evt-bare", "20261028T110000Z", "luma-test-taken"));
		// The page of the first describes no event; the second's image is on a host the job may not call.
		ANSWERS.put("/broken", new Answer(200, "text/html", "<html>Not found</html>".getBytes(UTF_8)));
		ANSWERS.put("/elsewhere", html(pageHtml("Elsewhere", "2026-10-26T18:00:00.000+07:00",
				"http://localhost:" + LUMA.getAddress().getPort() + "/x.png")));
		ANSWERS.put("/luma-test-taken", html(pageHtml("Bare", "2026-10-28T18:00:00.000+07:00", null)));

		assertThat(calendar.read(NOW)).isEqualTo(new LumaCalendar.Read(1, 0, 0, 2));

		assertThat(program("evt-bare")).containsEntry("slug", "luma-test-taken-2")
			.containsEntry("status", "draft")
			.containsEntry("cover_file_id", null);
		assertThat(jdbc.sql("select count(*) from program where luma_event_id in ('evt-broken', 'evt-elsewhere')")
			.query(Long.class)
			.single()).isZero();
		assertThat(ASKED).doesNotContain("/x.png");
	}

	private Map<String, Object> program(String eventId) {
		return jdbc.sql("select * from program where luma_event_id = ?").param(eventId).query().singleRow();
	}

	private static String event(String id, String startsAt, String path) {
		return """
				BEGIN:VEVENT
				DTSTART:%s
				UID:%s@events.lu.ma
				SUMMARY:Ignored
				DESCRIPTION:Get up-to-date information at: %s/%s\\n\\nHosted by Kai Yong
				END:VEVENT
				""".formatted(startsAt, id, base(), path);
	}

	private static void calendarOf(String... events) {
		String feed = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Luma//Test//EN\n" + String.join("", events)
				+ "END:VCALENDAR\n";
		ANSWERS.put("/ics", new Answer(200, "text/calendar", feed.getBytes(UTF_8)));
	}

	private static void page(String path, String name, String startsAt, String image) {
		ANSWERS.put("/" + path, html(pageHtml(name, startsAt, base() + image)));
	}

	private static String pageHtml(String name, String startsAt, String image) {
		return """
				<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Event",
				"name":"%s","description":"A private dinner with TinyFish's leadership.\\nIn Ho Chi Minh City.",
				"startDate":"%s","eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode",
				"location":{"@type":"Place","address":{"@type":"PostalAddress","addressCountry":"VN",
				"addressLocality":"Thành phố Hồ Chí Minh"}}%s}</script></head><body></body></html>
				""".formatted(name, startsAt, image == null ? "" : ",\"image\":[\"" + image + "\"]");
	}

	private static Answer html(String html) {
		return new Answer(200, "text/html; charset=utf-8", html.getBytes(UTF_8));
	}

	private static void image(String path) {
		ANSWERS.put(path, new Answer(200, "image/png", PNG));
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

	private static void answer(HttpExchange exchange) throws IOException {
		String path = exchange.getRequestURI().getPath();
		ASKED.add(path);
		try (InputStream ignored = exchange.getRequestBody()) {
			Answer answer = ANSWERS.getOrDefault(path, new Answer(404, "text/plain", "Not found".getBytes(UTF_8)));
			exchange.getResponseHeaders().set("Content-Type", answer.mediaType());
			exchange.sendResponseHeaders(answer.status(), answer.body().length);
			exchange.getResponseBody().write(answer.body());
		}
		finally {
			exchange.close();
		}
	}

}
