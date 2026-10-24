package ai.genaifund.beyondpilot.program;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
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
 * People registering on BeyondPilot for GenAI Fund's Luma events (BEY-245), against PostgreSQL and a stub of Luma's
 * API. The calendar is read by hand, then a signed-in person registers through the public API; the registration is
 * sent to Luma after it is kept, and the person is emailed what Luma made of it.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "beyondpilot.identity.operator-emails=operator@events.test",
				"beyondpilot.program.luma.registration-events=*" })
@Import({ TestcontainersConfiguration.class, EventRegistrationTest.Mail.class })
class EventRegistrationTest {

	private static final String KEY = "not a real key 5678";

	private static final String EVENT = "evt-briefing";

	private static final String SLUG = "gaf-briefing";

	private static final HttpServer LUMA = luma();

	/** What the stub answers, by method, path and the identifier of the event asked about. */
	private static final Map<String, Answer> ANSWERS = new ConcurrentHashMap<>();

	/** The bodies Luma was sent, each after the method and path it went to. */
	private static final List<String> BODIES = new CopyOnWriteArrayList<>();

	@Autowired
	private LumaCalendar calendar;

	@Autowired
	private RegistrationSender sender;

	@Autowired
	private RegistrationDecisions decisions;

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

	private record Answer(int status, String body) {
	}

	@DynamicPropertySource
	static void luma(DynamicPropertyRegistry registry) {
		registry.add("beyondpilot.program.luma.api", () -> "http://127.0.0.1:" + LUMA.getAddress().getPort());
		registry.add("beyondpilot.program.luma.site-url", () -> "https://beyondpilot.test");
		registry.add("beyondpilot.program.luma.encryption-key",
				() -> Base64.getEncoder().encodeToString(new byte[32]));
	}

	@BeforeEach
	void clear() {
		jdbc.sql("delete from program_luma_registration").update();
		jdbc.sql("delete from program where luma_event_id is not null").update();
		jdbc.sql("delete from program_luma_connection").update();
		ANSWERS.clear();
		BODIES.clear();
		LumaConnection connection = new LumaConnection(keys.seal(KEY), "5678", "cal-gaf", "GenAI Fund - Official",
				null, Instant.now());
		connections.saveAndFlush(connection);
	}

	@AfterAll
	static void stop() {
		LUMA.stop(0);
	}

	@Test
	void aVisitorReadsTheFormLumaGivesWithoutTheVenueKeptForGuests() {
		read(event(true, null, "enabled", true));

		assertThat(jdbc.sql("select page_kind from program where luma_event_id = ?").param(EVENT).query(String.class)
			.single()).isEqualTo("standard");
		client().get()
			.uri("/api/program/programs/" + SLUG + "/registration")
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.state").isEqualTo("open")
			.jsonPath("$.approval").isEqualTo(true)
			.jsonPath("$.zone").isEqualTo("Asia/Ho_Chi_Minh")
			.jsonPath("$.hosts[0]").isEqualTo("GenAI Fund")
			.jsonPath("$.questions[0].known").isEqualTo("name")
			.jsonPath("$.questions[2].options[1]").isEqualTo("Builder")
			.jsonPath("$.questions[4].termsUrl").isEqualTo("https://genaifund.test/terms.pdf")
			.jsonPath("$.venue").doesNotExist()
			.jsonPath("$.mine").doesNotExist();
	}

	@Test
	void aRegistrationIsKeptThenAddedToLumaAsPendingWithItsEmailOffAndThePersonIsTold() {
		read(event(true, null, "enabled", true));
		RestTestClient client = client();
		String session = TestSignIn.session(client, mail, "linh@events.test");
		guest("pending_approval", null);

		register(client, session, answers("Builder", true)).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.mine.status").isEqualTo("received")
			.jsonPath("$.mine.name").isEqualTo("Linh Tran");

		await().atMost(Duration.ofSeconds(10)).until(() -> "sent".equals(registration("linh@events.test").get("send_state")));
		assertThat(registration("linh@events.test")).containsEntry("status", "pending_approval")
			.containsEntry("luma_guest_id", "gst-linh")
			.containsEntry("emailed_status", "pending_approval");
		String added = BODIES.stream().filter(body -> body.startsWith("POST /v1/events/guests/add")).findFirst().orElseThrow();
		assertThat(added).contains("\"approval_status\":\"pending_approval\"", "\"send_email\":false",
				"\"email\":\"linh@events.test\"", "\"name\":\"Linh Tran\"",
				"{\"question_id\":\"q-name\",\"value\":\"Linh Tran\"}",
				"{\"question_id\":\"q-email\",\"value\":\"linh@events.test\"}",
				"{\"question_id\":\"q-company\",\"value\":{\"company\":\"Plain Cover\",\"job_title\":\"CTO\"}}",
				"{\"question_id\":\"q-terms\",\"value\":true}");
		await().atMost(Duration.ofSeconds(10))
			.until(() -> mail.subjectsTo("linh@events.test").contains("Registration received: Product briefing"));
		client.get()
			.uri("/api/program/programs/" + SLUG + "/registration")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectBody()
			.jsonPath("$.mine.status").isEqualTo("pending_approval")
			.jsonPath("$.mine.checkInImageUrl").doesNotExist()
			.jsonPath("$.venue").doesNotExist();

		register(client, session, answers("Builder", true)).expectStatus()
			.isEqualTo(409)
			.expectBody()
			.jsonPath("$.code").isEqualTo("PROGRAM_REGISTRATION_EXISTS");
	}

	@Test
	void answersAreCheckedHereAndAFormFilledBeforeTheHostChangedItIsRefused() {
		read(event(true, null, "enabled", true));
		RestTestClient client = client();
		String session = TestSignIn.session(client, mail, "minh@events.test");

		register(client, session, answers("Astronaut", true)).expectStatus()
			.isBadRequest()
			.expectBody()
			.jsonPath("$.code").isEqualTo("PROGRAM_REGISTRATION_ANSWERS_INVALID");
		register(client, session, answers("Builder", false)).expectStatus()
			.isBadRequest()
			.expectBody()
			.jsonPath("$.code").isEqualTo("PROGRAM_REGISTRATION_ANSWERS_INVALID");
		Map<String, Object> stale = new HashMap<>(answers("Builder", true));
		stale.put("formVersion", "0000");
		register(client, session, stale).expectStatus()
			.isEqualTo(409)
			.expectBody()
			.jsonPath("$.code").isEqualTo("PROGRAM_REGISTRATION_FORM_CHANGED");
		register(client(), "", answers("Builder", true)).expectStatus().isUnauthorized();

		assertThat(jdbc.sql("select count(*) from program_luma_registration").query(Long.class).single()).isZero();
		assertThat(BODIES).noneMatch(body -> body.startsWith("POST /v1/events/guests/add"));
	}

	@Test
	void anEventWithoutApprovalConfirmsAtOnceWithTheCheckInCodeAndACalendarFile() {
		read(event(false, null, "enabled", true));
		RestTestClient client = client();
		String session = TestSignIn.session(client, mail, "an@events.test");
		guest("approved", "https://luma.com/check-in/evt-briefing?pk=g-an");

		register(client, session, answers("Builder", true)).expectStatus().isOk();

		await().atMost(Duration.ofSeconds(10)).until(() -> "sent".equals(registration("an@events.test").get("send_state")));
		assertThat(BODIES).anyMatch(body -> body.startsWith("POST /v1/events/guests/add")
				&& body.contains("\"approval_status\":\"approved\""));
		await().atMost(Duration.ofSeconds(10))
			.until(() -> mail.subjectsTo("an@events.test").contains("You're in: Product briefing"));
		String ticket = (String) registration("an@events.test").get("ticket");
		assertThat(mail.textTo("an@events.test", "You're in: Product briefing"))
			.contains("/api/program/tickets/" + ticket + "/check-in.png", "/api/program/tickets/" + ticket + "/event.ics");
		client.get()
			.uri("/api/program/programs/" + SLUG + "/registration")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectBody()
			.jsonPath("$.mine.status").isEqualTo("approved")
			.jsonPath("$.mine.checkInImageUrl")
			.isEqualTo("https://beyondpilot.test/api/program/tickets/" + ticket + "/check-in.png")
			.jsonPath("$.venue").isEqualTo("24 Nguyễn Thị Nghĩa, Quận 1");

		client().get()
			.uri("/api/program/tickets/" + ticket + "/check-in.png")
			.exchange()
			.expectStatus()
			.isOk()
			.expectHeader()
			.contentType(MediaType.IMAGE_PNG);
		String file = client().get()
			.uri("/api/program/tickets/" + ticket + "/event.ics")
			.exchange()
			.expectStatus()
			.isOk()
			.returnResult(String.class)
			.getResponseBody();
		assertThat(file).contains("SUMMARY:Product briefing", "LOCATION:24 Nguyễn Thị Nghĩa\\, Quận 1",
				"DTSTART:20991026T110000Z");
		client().get().uri("/api/program/tickets/not-a-ticket/check-in.png").exchange().expectStatus().isNotFound();
	}

	@Test
	void aFullEventPutsANewGuestOnItsWaitlistOrTakesNoMore() {
		read(event(true, 0, "enabled", true));
		RestTestClient client = client();
		String session = TestSignIn.session(client, mail, "ha@events.test");
		guest("waitlist", null);

		register(client, session, answers("Builder", true)).expectStatus().isOk();
		await().atMost(Duration.ofSeconds(10))
			.until(() -> mail.subjectsTo("ha@events.test").contains("On the waitlist: Product briefing"));
		assertThat(BODIES).anyMatch(body -> body.contains("\"approval_status\":\"waitlist\""));

		read(event(true, 0, "disabled", true));
		String other = TestSignIn.session(client, mail, "tu@events.test");
		register(client, other, answers("Builder", true)).expectStatus()
			.isEqualTo(409)
			.expectBody()
			.jsonPath("$.code").isEqualTo("PROGRAM_REGISTRATION_CLOSED");
	}

	@Test
	void aRegistrationLumaCannotTakeNowIsTriedAgainLaterAndOneItRefusesStops() {
		read(event(true, null, "enabled", true));
		RestTestClient client = client();
		String session = TestSignIn.session(client, mail, "vy@events.test");
		ANSWERS.put("POST /v1/events/guests/add", new Answer(503, "{}"));

		register(client, session, answers("Builder", true)).expectStatus().isOk();
		await().atMost(Duration.ofSeconds(10)).until(() -> ((Number) registration("vy@events.test").get("attempts")).intValue() == 1);
		Map<String, Object> waiting = registration("vy@events.test");
		assertThat(waiting).containsEntry("send_state", "waiting").containsEntry("send_error", "Luma did not answer");
		assertThat(mail.subjectsTo("vy@events.test")).noneMatch(subject -> subject.contains("Product briefing"));

		ANSWERS.put("POST /v1/events/guests/add", new Answer(200, "{\"skipped\":[]}"));
		guest("pending_approval", null);
		UUID id = (UUID) waiting.get("id");
		sender.send(id, Instant.now());
		assertThat(registration("vy@events.test")).containsEntry("send_state", "waiting");
		sender.send(id, Instant.now().plus(Duration.ofMinutes(2)));
		assertThat(registration("vy@events.test")).containsEntry("send_state", "sent")
			.containsEntry("status", "pending_approval");

		String refused = TestSignIn.session(client, mail, "kim@events.test");
		ANSWERS.put("POST /v1/events/guests/add", new Answer(400, "{\"message\":\"No such question\"}"));
		register(client, refused, answers("Builder", true)).expectStatus().isOk();
		await().atMost(Duration.ofSeconds(10)).until(() -> "failed".equals(registration("kim@events.test").get("send_state")));
		assertThat(registration("kim@events.test")).containsEntry("send_error", "Luma refused the answers");
	}

	@Test
	void anEventWithAPriceIsRegisteredForOnLuma() {
		read(event(true, null, "enabled", true).replace("\"display_price\":null", "\"display_price\":\"$20\""));

		assertThat(jdbc.sql("select page_kind from program where luma_event_id = ?").param(EVENT).query(String.class)
			.single()).isEqualTo("external");
		client().get()
			.uri("/api/program/programs/" + SLUG + "/registration")
			.exchange()
			.expectStatus()
			.isNotFound()
			.expectBody()
			.jsonPath("$.code").isEqualTo("PROGRAM_REGISTRATION_NOT_HERE");
	}

	@Test
	void aDecisionOnLumaComesBackByItsWebhookAndThePersonIsToldOnceForEachStatus() {
		read(event(true, null, "enabled", true));
		connections.findAll().forEach(held -> {
			held.hooked("wh-1", keys.seal("whsec_test"), Instant.now());
			connections.saveAndFlush(held);
		});
		RestTestClient client = client();
		String session = TestSignIn.session(client, mail, "mai@events.test");
		guest("pending_approval", null);
		register(client, session, answers("Builder", true)).expectStatus().isOk();
		await().atMost(Duration.ofSeconds(10)).until(() -> "pending_approval".equals(registration("mai@events.test").get("emailed_status")));

		// GenAI Fund approves her on Luma: the delivery only makes the event's guests be read again.
		guests("approved", "https://luma.com/check-in/evt-briefing?pk=g-mai");
		deliver(client, "{\"type\":\"guest.updated\",\"data\":{\"id\":\"gst-linh\",\"approval_status\":\"declined\","
				+ "\"event\":{\"id\":\"" + EVENT + "\"}}}").expectStatus().isNoContent();
		await().atMost(Duration.ofSeconds(10))
			.until(() -> mail.subjectsTo("mai@events.test").contains("You're in: Product briefing"));
		assertThat(registration("mai@events.test")).containsEntry("status", "approved")
			.containsEntry("check_in_url", "https://luma.com/check-in/evt-briefing?pk=g-mai")
			.containsEntry("emailed_status", "approved");
		client.get()
			.uri("/api/program/programs/" + SLUG + "/registration")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectBody()
			.jsonPath("$.mine.status").isEqualTo("approved");

		// The hourly check finds nothing new and tells nobody again; a later decline is told once.
		decisions.check(EVENT, Instant.now());
		assertThat(mail.subjectsTo("mai@events.test")).filteredOn(subject -> subject.startsWith("You're in")).hasSize(1);
		guests("declined", null);
		decisions.check(EVENT, Instant.now());
		await().atMost(Duration.ofSeconds(10))
			.until(() -> mail.subjectsTo("mai@events.test").contains("About your registration: Product briefing"));
		assertThat(registration("mai@events.test")).containsEntry("status", "declined");

		// A delivery not signed with the webhook's secret changes nothing.
		deliver(client, "{\"type\":\"guest.updated\",\"data\":{\"event\":{\"id\":\"" + EVENT + "\"}}}", "other")
			.expectStatus()
			.isForbidden();
	}

	/** The event's guest list on Luma: Mai, in the status given. */
	private static void guests(String status, @Nullable String checkIn) {
		ANSWERS.put("GET /v1/events/guests/list?event_id=" + EVENT, new Answer(200,
				"{\"entries\":[{\"guest\":{\"id\":\"gst-linh\",\"user_email\":\"mai@events.test\",\"approval_status\":\"%s\"%s}}],\"has_more\":false}"
					.formatted(status, checkIn == null ? "" : ",\"check_in_qr_code\":\"" + checkIn + "\"")));
	}

	private RestTestClient.ResponseSpec deliver(RestTestClient client, String body) {
		return deliver(client, body, "whsec_test");
	}

	private RestTestClient.ResponseSpec deliver(RestTestClient client, String body, String secret) {
		long now = Instant.now().getEpochSecond();
		byte[] bytes = body.getBytes(UTF_8);
		return client.post()
			.uri("/api/program/luma/webhook")
			.contentType(MediaType.APPLICATION_JSON)
			.header("Webhook-Signature", "t=" + now + ",v1=" + HexFormat.of().formatHex(LumaSignature.sign(secret, now, bytes)))
			.body(bytes)
			.exchange();
	}

	/** The calendar holds the event alone, published, and is read. */
	private void read(String event) {
		ANSWERS.put("GET /v1/calendars/events/list?access=manage", new Answer(200, "{\"entries\":[" + event + "]}"));
		ANSWERS.put("GET /v1/calendars/events/list?access=view", new Answer(200, "{\"entries\":[]}"));
		ANSWERS.put("GET /v1/events/get?event_id=" + EVENT, new Answer(200, event));
		ANSWERS.putIfAbsent("POST /v1/events/guests/add", new Answer(200, "{\"skipped\":[]}"));
		assertThat(calendar.read(Instant.parse("2026-10-23T05:00:00Z")).outcome()).isEqualTo(LumaCalendar.Outcome.READ);
		// The event has no cover, which publishing asks for, so it is published here as an operator would.
		jdbc.sql("update program set status = 'published', published_at = now() where luma_event_id = ?")
			.param(EVENT)
			.update();
	}

	/** The guest Luma gives back after an add. */
	private static void guest(String status, @Nullable String checkIn) {
		ANSWERS.put("GET /v1/events/guests/get?event_id=" + EVENT,
				new Answer(200, "{\"id\":\"gst-%s\",\"approval_status\":\"%s\"%s}".formatted("linh", status,
						checkIn == null ? "" : ",\"check_in_qr_code\":\"" + checkIn + "\"")));
	}

	/**
	 * A public event far ahead, held at a venue Luma keeps for guests, with a question of each kind people answer most:
	 * the name again, the email again, a select, a company with the job title, and terms to agree to.
	 */
	private static String event(boolean approval, @Nullable Integer seats, String waitlist,
			boolean open) {
		return """
				{"id":"%s","name":"Product briefing","start_at":"2099-10-26T11:00:00Z","end_at":"2099-10-26T13:00:00Z",
				"timezone":"Asia/Ho_Chi_Minh","location_type":"offline","location_visibility":"guests-only",
				"geo_address_json":{"city":"Thành phố Hồ Chí Minh","country":"VN","full_address":"24 Nguyễn Thị Nghĩa, Quận 1"},
				"url":"https://luma.com/%s","visibility":"public","access":"manage","display_price":null,
				"registration_open":%s,"require_approval":%s,"spots_remaining":%s,"waitlist_status":"%s",
				"hosts":[{"name":"GenAI Fund"}],
				"registration_questions":[
				{"id":"q-name","label":"Name","required":true,"question_type":"text"},
				{"id":"q-email","label":"Email","required":true,"question_type":"text"},
				{"id":"q-role","label":"Your role","required":true,"question_type":"select","options":["Investor","Builder"]},
				{"id":"q-company","label":"Company","required":true,"question_type":"company","collect_job_title":true},
				{"id":"q-terms","label":"Terms","required":true,"question_type":"terms",
				"terms":{"content_type":"link","url":"https://genaifund.test/terms.pdf"}}]}"""
			.formatted(EVENT, SLUG, open, approval, seats == null ? "null" : seats, waitlist);
	}

	/** The request of a registration with the role given, and the terms agreed to or not. */
	private Map<String, Object> answers(String role, boolean terms) {
		String version = client().get()
			.uri("/api/program/programs/" + SLUG + "/registration")
			.exchange()
			.returnResult(Map.class)
			.getResponseBody()
			.get("formVersion")
			.toString();
		return Map.of("name", "Linh Tran", "formVersion", version, "answers",
				List.of(Map.of("questionId", "q-role", "text", role),
						Map.of("questionId", "q-company", "company", "Plain Cover", "jobTitle", "CTO"),
						Map.of("questionId", "q-terms", "agreed", terms)));
	}

	private RestTestClient.ResponseSpec register(RestTestClient client, String session, Map<String, Object> body) {
		RestTestClient.RequestBodySpec request = client.post()
			.uri("/api/program/programs/" + SLUG + "/registration")
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON);
		if (!session.isEmpty()) {
			request.cookie(TestSignIn.SESSION_COOKIE, session);
		}
		return request.body(body).exchange();
	}

	private Map<String, Object> registration(String email) {
		return jdbc.sql("select * from program_luma_registration where email = ?").param(email).query().singleRow();
	}

	private RestTestClient client() {
		return RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
	}

	/** The test mailbox, through a class of this test's own, as {@code ProgramAdministrationTest} imports it. */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

	private static HttpServer luma() {
		try {
			HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			server.createContext("/", EventRegistrationTest::answer);
			server.start();
			return server;
		}
		catch (IOException failed) {
			throw new UncheckedIOException(failed);
		}
	}

	/** Answers by method, path and the event asked about. */
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
		try (InputStream body = exchange.getRequestBody()) {
			byte[] sent = body.readAllBytes();
			if (sent.length > 0) {
				BODIES.add(asked + " " + new String(sent, UTF_8));
			}
			Answer answer = ANSWERS.getOrDefault(asked, new Answer(404, "{}"));
			byte[] reply = answer.body().getBytes(UTF_8);
			exchange.getResponseHeaders().set("Content-Type", "application/json");
			exchange.sendResponseHeaders(answer.status(), reply.length);
			exchange.getResponseBody().write(reply);
		}
		finally {
			exchange.close();
		}
	}

}
