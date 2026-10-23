package ai.genaifund.beyondpilot.program;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import ai.genaifund.beyondpilot.BusinessException;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.program.persistence.LumaConnection;
import ai.genaifund.beyondpilot.program.persistence.LumaConnectionRepository;
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
 * Events an operator creates from the MCP on the Luma calendar (BEY-250), against PostgreSQL and a stub of Luma's API,
 * set up as staging is: events created here are named as tests, and take registrations though no event is named.
 */
@SpringBootTest(properties = { "beyondpilot.identity.operator-emails=operator@create.test",
		"beyondpilot.program.luma.created-name-prefix=[TEST] " })
@Import(TestcontainersConfiguration.class)
class EventCreationTest {

	private static final String KEY = "not a real key 9012";

	private static final String EVENT = "evt-made";

	private static final HttpServer LUMA = luma();

	/** What the stub answers, by method and path. */
	private static final Map<String, String> ANSWERS = new ConcurrentHashMap<>();

	/** The bodies Luma was sent, each after the method and path it went to. */
	private static final List<String> BODIES = new CopyOnWriteArrayList<>();

	@Autowired
	private EventCreation creation;

	@Autowired
	private LumaKeys keys;

	@Autowired
	private LumaConnectionRepository connections;

	@Autowired
	private JdbcClient jdbc;

	@DynamicPropertySource
	static void luma(DynamicPropertyRegistry registry) {
		registry.add("beyondpilot.program.luma.api", () -> "http://127.0.0.1:" + LUMA.getAddress().getPort());
		registry.add("beyondpilot.program.luma.encryption-key",
				() -> Base64.getEncoder().encodeToString(new byte[32]));
	}

	@BeforeEach
	void clear() {
		jdbc.sql("delete from program where luma_event_id is not null").update();
		jdbc.sql("delete from program_luma_connection").update();
		ANSWERS.clear();
		BODIES.clear();
		connections.saveAndFlush(new LumaConnection(keys.seal(KEY), "9012", "cal-gaf", "GenAI Fund - Official", null,
				Instant.now()));
	}

	@AfterAll
	static void stop() {
		LUMA.stop(0);
	}

	@Test
	void anEventIsCreatedPrivateOnLumaAsATestAndItsDraftPageTakesRegistrations() {
		ANSWERS.put("POST /v1/events/create", "{\"id\":\"" + EVENT + "\"}");
		ANSWERS.put("GET /v1/events/get", """
				{"event":{"id":"%s","name":"[TEST] Founders breakfast","start_at":"2099-11-20T01:00:00Z",
				"end_at":"2099-11-20T03:00:00Z","timezone":"Asia/Ho_Chi_Minh","location_type":"offline",
				"geo_address_json":{"full_address":"12 Lê Lợi, Quận 1"},"url":"https://luma.com/founders-breakfast",
				"visibility":"private","access":"manage","display_price":null,"registration_open":true,
				"require_approval":true,"spots_remaining":40,"waitlist_status":"enabled","hosts":[{"name":"GenAI Fund"}],
				"registration_questions":[{"id":"bp-1","label":"Your role","required":true,"question_type":"select",
				"options":["Founder","Investor"],"multiple":false},
				{"id":"bp-2","label":"What are you building?","required":false,"question_type":"text","multiline":true}]}}"""
			.formatted(EVENT));

		EventCreation.CreatedEvent created = creation.onLuma(operator(),
				event(List.of(new EventCreation.Question("Your role", "select", true, List.of("Founder", "Investor")),
						new EventCreation.Question("What are you building?", "long_text", false, List.of()))));

		assertThat(created.name()).isEqualTo("[TEST] Founders breakfast");
		assertThat(created.lumaEventId()).isEqualTo(EVENT);
		assertThat(created.slug()).isEqualTo("founders-breakfast");
		String sent = BODIES.stream().filter(body -> body.startsWith("POST /v1/events/create")).findFirst().orElseThrow();
		assertThat(sent).contains("\"name\":\"[TEST] Founders breakfast\"", "\"visibility\":\"private\"",
				"\"start_at\":\"2099-11-20T01:00:00Z\"", "\"timezone\":\"Asia/Ho_Chi_Minh\"",
				"\"geo_address_json\":{\"type\":\"manual\",\"address\":\"12 Lê Lợi, Quận 1\"}",
				"\"location_visibility\":\"guests-only\"", "\"max_capacity\":40", "\"waitlist_status\":\"enabled\"",
				"\"ticket_types\":[{\"name\":\"Standard\",\"type\":\"free\",\"require_approval\":true}]",
				"{\"id\":\"bp-1\",\"label\":\"Your role\",\"required\":true,\"question_type\":\"select\","
						+ "\"options\":[\"Founder\",\"Investor\"],\"multiple\":false}",
				"{\"id\":\"bp-2\",\"label\":\"What are you building?\",\"required\":false,\"question_type\":\"text\","
						+ "\"multiline\":true}");
		// A draft with its registration form, which the name lets this environment take.
		assertThat(jdbc.sql("select status || ' ' || page_kind || ' ' || (luma_form is not null) from program where id = ?")
			.param(created.programId())
			.query(String.class)
			.single()).isEqualTo("draft standard true");
		assertThat(jdbc.sql("select actor_email || ' ' || (details ->> 'event') from audit_event where action = ? and resource_id = ?")
			.params("program.luma_event_create", String.valueOf(created.programId()))
			.query(String.class)
			.single()).isEqualTo("operator@create.test " + EVENT);
	}

	@Test
	void anEventLumaRefusesOrAQuestionTheFormCannotAskCreatesNothing() {
		ANSWERS.put("POST /v1/events/create", "!400");

		assertThatThrownBy(() -> creation.onLuma(operator(), event(List.of())))
			.isInstanceOfSatisfying(BusinessException.class,
					refused -> assertThat(refused.code()).isEqualTo("PROGRAM_LUMA_EVENT_REFUSED"));
		assertThatThrownBy(() -> creation.onLuma(operator(),
				event(List.of(new EventCreation.Question("Phone", "phone", true, List.of())))))
			.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> creation.onLuma(operator(),
				event(List.of(new EventCreation.Question("Role", "select", true, List.of("Only one"))))))
			.isInstanceOf(IllegalArgumentException.class);
		assertThat(jdbc.sql("select count(*) from program where luma_event_id is not null").query(Integer.class).single())
			.isZero();
		assertThat(BODIES).hasSize(1);
	}

	/** The operator's account, made once. */
	private Actor operator() {
		jdbc.sql("""
				insert into identity_account (id, email, display_name, status, platform_role)
				values (?, 'operator@create.test', 'Operator', 'active', 'operator') on conflict (lower(email)) do nothing
				""").param(UUID.randomUUID()).update();
		return new Actor(jdbc.sql("select id from identity_account where email = 'operator@create.test'")
			.query(UUID.class)
			.single());
	}

	private static EventCreation.NewEvent event(List<EventCreation.Question> questions) {
		return new EventCreation.NewEvent("Founders breakfast", Instant.parse("2099-11-20T01:00:00Z"),
				Instant.parse("2099-11-20T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"), "12 Lê Lợi, Quận 1", null, null,
				null, "Breakfast with the founders of the fund's companies.", null, true, 40, true, true, questions,
				null);
	}

	private static HttpServer luma() {
		try {
			HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			server.createContext("/", EventCreationTest::answer);
			server.start();
			return server;
		}
		catch (IOException failed) {
			throw new UncheckedIOException(failed);
		}
	}

	/** Answers by method and path; an answer {@code !<status>} is that status with an empty object. */
	private static void answer(HttpExchange exchange) throws IOException {
		String asked = exchange.getRequestMethod() + " " + exchange.getRequestURI().getPath();
		try (InputStream body = exchange.getRequestBody()) {
			byte[] sent = body.readAllBytes();
			if (sent.length > 0) {
				BODIES.add(asked + " " + new String(sent, UTF_8));
			}
			String answer = ANSWERS.getOrDefault(asked, "!404");
			int status = answer.startsWith("!") ? Integer.parseInt(answer.substring(1)) : 200;
			byte[] reply = (answer.startsWith("!") ? "{}" : answer).getBytes(UTF_8);
			exchange.getResponseHeaders().set("Content-Type", "application/json");
			exchange.sendResponseHeaders(status, reply.length);
			exchange.getResponseBody().write(reply);
		}
		finally {
			exchange.close();
		}
	}

}
