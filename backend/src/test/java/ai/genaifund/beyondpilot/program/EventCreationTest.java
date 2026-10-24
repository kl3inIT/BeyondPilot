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
import java.util.Objects;
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
import org.jspecify.annotations.Nullable;
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
 * Events an operator creates and changes from the MCP on the Luma calendar (BEY-250), against PostgreSQL and a stub of Luma's API,
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
	private EventChanges changes;

	@Autowired
	private EventGuests guests;

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
		jdbc.sql("delete from program_luma_registration where program_id in (select id from program where luma_event_id is not null)")
			.update();
		jdbc.sql("delete from program where luma_event_id is not null or slug like 'partner-night%'").update();
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
		assertThat(created.slug()).isEqualTo("test-founders-breakfast");
		assertThat(created.existing()).isFalse();
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

	@Test
	void anEventAlreadyOnTheCalendarIsFoundByAnyOfItsLinksAndNothingIsCreated() {
		onCalendar("[TEST] GenAI Builders Meetup Singapore", "f2jpv3fl", "private");

		// Its manage link, which an operator copies from Luma, brings it now as a draft with its form.
		EventCreation.CreatedEvent found = creation.fromLuma(operator(),
				"https://luma.com/event/manage/" + EVENT + "?tab=guests");
		assertThat(found.existing()).isFalse();
		assertThat(found.lumaEventId()).isEqualTo(EVENT);
		assertThat(found.status()).isEqualTo("draft");
		assertThat(found.slug()).isEqualTo("test-genai-builders-meetup-singapore");
		assertThat(jdbc.sql("select page_kind || ' ' || (luma_form is not null) from program where id = ?")
			.param(found.programId())
			.query(String.class)
			.single()).isEqualTo("standard true");

		// Its public link on either address, its identifier, a link to it as the registration of a page here
		// alone, and a new event of the same name on the same day all answer that page, creating nothing.
		assertThat(creation.fromLuma(operator(), "https://lu.ma/F2JPV3FL/").programId()).isEqualTo(found.programId());
		assertThat(creation.fromLuma(operator(), " " + EVENT + " ").existing()).isTrue();
		EventCreation.CreatedEvent linked = creation.here(operator(), withRegistration("https://luma.com/f2jpv3fl"));
		assertThat(linked.programId()).isEqualTo(found.programId());
		assertThat(linked.existing()).isTrue();
		EventCreation.CreatedEvent twin = creation.onLuma(operator(), new EventCreation.NewEvent(
				"genai builders meetup singapore", Instant.parse("2099-11-19T12:00:00Z"), null,
				ZoneId.of("Asia/Singapore"), null, null, null, null, null, null, false, null, false, false, List.of(),
				null));
		assertThat(twin.programId()).isEqualTo(found.programId());
		assertThat(BODIES).noneMatch(body -> body.startsWith("POST /v1/events/create"));
		assertThat(jdbc.sql("select count(*) from program where name ilike '%builders meetup%'")
			.query(Integer.class)
			.single()).isOne();
	}

	@Test
	void aLinkTheCalendarDoesNotHoldIsRefusedAndAPartnersLumaLinkStillMakesAPageHere() {
		onCalendar("[TEST] GenAI Builders Meetup Singapore", "f2jpv3fl", "private");

		assertThatThrownBy(() -> creation.fromLuma(operator(), "https://luma.com/someone-elses-party"))
			.isInstanceOfSatisfying(BusinessException.class,
					refused -> assertThat(refused.code()).isEqualTo("PROGRAM_LUMA_EVENT_NOT_FOUND"));
		assertThatThrownBy(() -> creation.fromLuma(operator(), "https://example.com/events/" + "f2jpv3fl"))
			.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> creation.fromLuma(operator(), "the meetup next month"))
			.isInstanceOf(IllegalArgumentException.class);

		// A partner's event on Luma, outside the calendar: a page here alone, linking there.
		EventCreation.CreatedEvent partner = creation.here(operator(),
				withRegistration("https://luma.com/partner-night"));
		assertThat(partner.existing()).isFalse();
		assertThat(partner.lumaEventId()).isNull();
		assertThat(jdbc.sql("select page_kind || ' ' || external_url from program where id = ?")
			.param(partner.programId())
			.query(String.class)
			.single()).isEqualTo("external https://luma.com/partner-night");

		// With Luma down, an event identifier cannot be found, and nothing is made.
		ANSWERS.put("GET /v1/events/get", "!503");
		assertThatThrownBy(() -> creation.fromLuma(operator(), "evt-unknown"))
			.isInstanceOfSatisfying(BusinessException.class,
					refused -> assertThat(refused.code()).isEqualTo("PROGRAM_LUMA_UNREACHABLE"));
		connections.deleteAll();
		assertThatThrownBy(() -> creation.fromLuma(operator(), EVENT))
			.isInstanceOfSatisfying(BusinessException.class,
					refused -> assertThat(refused.code()).isEqualTo("PROGRAM_LUMA_NOT_CONFIGURED"));
	}

	@Test
	void anEventOfTheCalendarIsReadThenChangedOnLumaAndItsPageFollowsAtOnce() {
		onCalendar("[TEST] GenAI Builders Meetup Singapore", "f2jpv3fl", "private");
		ANSWERS.put("POST /v1/events/update", "{}");
		EventCreation.CreatedEvent found = creation.fromLuma(operator(), EVENT);

		// Its page's address here names it, and nothing given changes nothing: it is read as it stands.
		EventChanges.ChangedEvent read = changes.change(operator(),
				"https://beyondpilot.vadan.app/programs/" + found.slug() + "?from=mail", nothing());
		assertThat(read.changed()).isEmpty();
		assertThat(read.programId()).isEqualTo(found.programId());
		EventChanges.OnLuma held = Objects.requireNonNull(read.luma());
		assertThat(held.visibility()).isEqualTo("private");
		assertThat(held.questions()).containsExactly(
				new EventCreation.Question("Your role", "select", true, List.of("Founder", "Investor")));
		assertThat(BODIES).noneMatch(body -> body.startsWith("POST /v1/events/update"));

		// A new start alone keeps the event's two hours; a question kept by its label and type keeps its identifier
		// on Luma, so its answers stay; no limit is sent as null; nothing left out is sent.
		EventChanges.ChangedEvent changed = changes.change(operator(), "program:" + found.slug(),
				new EventChanges.Change("[TEST] GenAI Builders Meetup SG", Instant.parse("2099-11-19T11:00:00Z"), null,
						null, null, null, null, null, 0, null,
						List.of(new EventCreation.Question("your role ", "select", true,
								List.of("Founder", "Investor", "Engineer")),
								new EventCreation.Question("LinkedIn", "linkedin", false, List.of())),
						"public", null, null, false, null, null, null, null));
		assertThat(changed.changed()).containsExactly("name", "starts_at", "capacity", "questions", "visibility");
		String sent = BODIES.stream().filter(body -> body.startsWith("POST /v1/events/update")).findFirst().orElseThrow();
		assertThat(sent).contains("\"event_id\":\"" + EVENT + "\"", "\"name\":\"[TEST] GenAI Builders Meetup SG\"",
				"\"start_at\":\"2099-11-19T11:00:00Z\"", "\"end_at\":\"2099-11-19T13:00:00Z\"",
				"\"max_capacity\":null", "\"visibility\":\"public\"", "\"suppress_email\":true",
				"{\"id\":\"q-role\",\"label\":\"your role\",\"required\":true,\"question_type\":\"select\","
						+ "\"options\":[\"Founder\",\"Investor\",\"Engineer\"],\"multiple\":false}",
				"\"label\":\"LinkedIn\",\"required\":false,\"question_type\":\"linkedin\"");
		assertThat(sent).containsPattern("\"id\":\"bp-[0-9a-f]{8}\",\"label\":\"LinkedIn\"")
			.doesNotContain("description_md", "geo_address_json", "timezone", "waitlist_status");
		// Read again at once: the page is what Luma now says.
		assertThat(BODIES.stream().filter(body -> body.startsWith("POST /v1/events/update"))).hasSize(1);
		assertThat(changed.pending()).isFalse();
		assertThat(jdbc.sql("select actor_email || ' ' || (details ->> 'event') from audit_event where action = ? and resource_id = ?")
			.params("program.luma_event_update", String.valueOf(found.programId()))
			.query(String.class)
			.single()).isEqualTo("operator@create.test " + EVENT);
	}

	@Test
	void aChangeThatDoesNotFitTheEventOrThatLumaRefusesChangesNothing() {
		onCalendar("[TEST] GenAI Builders Meetup Singapore", "f2jpv3fl", "private");
		EventCreation.CreatedEvent found = creation.fromLuma(operator(), EVENT);
		String page = "program:" + found.slug();

		assertThatThrownBy(() -> changes.change(operator(), page, new EventChanges.Change(null, null, null, null, null,
				null, null, null, null, null, null, null, null, null, true, "Singapore", null, "A summary.", null)))
			.isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("city, summary");
		assertThatThrownBy(() -> changes.change(operator(), page,
				startingAt(Instant.parse("2020-01-01T00:00:00Z"), null)))
			.hasMessageContaining("future");
		assertThatThrownBy(() -> changes.change(operator(), page, startingAt(null, Instant.parse("2099-11-19T09:00:00Z"))))
			.hasMessageContaining("after the start");
		assertThatThrownBy(() -> changes.change(operator(), page, new EventChanges.Change(null, null, null, null,
				"1 Fusionopolis Way", "https://meet.test/x", null, null, null, null, null, null, null, null, true, null, null, null,
				null)))
			.hasMessageContaining("not both");
		assertThatThrownBy(() -> changes.change(operator(), page, new EventChanges.Change(null, null, null, null, null,
				null, null, null, null, null, null, "members", null, null, true, null, null, null, null)))
			.hasMessageContaining("public or private");
		assertThatThrownBy(() -> changes.change(operator(), "no-such-event", nothing()))
			.isInstanceOfSatisfying(BusinessException.class,
					refused -> assertThat(refused.code()).isEqualTo("PROGRAM_NOT_FOUND"));
		assertThatThrownBy(() -> changes.change(operator(), "https://example.com/meetup", nothing()))
			.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> changes.change(operator(), "https://luma.com/someone-elses-party", nothing()))
			.isInstanceOfSatisfying(BusinessException.class,
					refused -> assertThat(refused.code()).isEqualTo("PROGRAM_LUMA_EVENT_NOT_FOUND"));
		assertThat(BODIES).noneMatch(body -> body.startsWith("POST /v1/events/update"));

		// Luma refuses the change, or cannot be reached: said back, and nothing is recorded.
		ANSWERS.put("POST /v1/events/update", "!400");
		assertThatThrownBy(() -> changes.change(operator(), page, renamed()))
			.isInstanceOfSatisfying(BusinessException.class,
					refused -> assertThat(refused.code()).isEqualTo("PROGRAM_LUMA_EVENT_REFUSED"));
		ANSWERS.put("POST /v1/events/update", "!503");
		assertThatThrownBy(() -> changes.change(operator(), page, renamed()))
			.isInstanceOfSatisfying(BusinessException.class,
					refused -> assertThat(refused.code()).isEqualTo("PROGRAM_LUMA_UNREACHABLE"));
		assertThat(jdbc.sql("select count(*) from audit_event where action = 'program.luma_event_update' and resource_id = ?")
			.param(String.valueOf(found.programId()))
			.query(Integer.class)
			.single()).isZero();

		// A form asking what this tool cannot write keeps its questions; an event another host runs is theirs.
		ANSWERS.put("POST /v1/events/update", "{}");
		ANSWERS.put("GET /v1/events/get", ANSWERS.get("GET /v1/events/get")
			.replace("\"multiple\":false}]", "\"multiple\":false},{\"id\":\"q-phone\",\"label\":\"Phone\","
					+ "\"required\":false,\"question_type\":\"phone-number\"}]"));
		assertThatThrownBy(() -> changes.change(operator(), page, new EventChanges.Change(null, null, null, null, null,
				null, null, null, null, null, List.of(), null, null, null, true, null, null, null, null)))
			.hasMessageContaining("Phone");
		ANSWERS.put("GET /v1/events/get", ANSWERS.get("GET /v1/events/get").replace("\"access\":\"manage\"",
				"\"access\":\"view\""));
		assertThatThrownBy(() -> changes.change(operator(), page, renamed())).hasMessageContaining("Another host");
		assertThat(BODIES.stream().filter(body -> body.startsWith("POST /v1/events/update"))).hasSize(2);
	}

	@Test
	void anEventOnBeyondPilotAloneIsSavedAsItsSettingsWould() {
		EventCreation.CreatedEvent partner = creation.here(operator(), withRegistration("https://partner.test/night"));
		String page = partner.slug();

		EventChanges.ChangedEvent changed = changes.change(operator(), page, new EventChanges.Change("Partner night II",
				Instant.parse("2099-11-21T13:00:00Z"), null, ZoneId.of("Asia/Ho_Chi_Minh"), "8 Nguyễn Huệ", null, null,
				"An evening with the partners.", null, null, null, null, null, null, true, null, null, "Partners meet.",
				"https://partner.test/night-2"));
		assertThat(changed.luma()).isNull();
		assertThat(changed.slug()).isEqualTo(page);
		assertThat(jdbc.sql("""
				select p.name || ' | ' || p.summary || ' | ' || p.about || ' | ' || p.starts_on || ' | ' || p.external_url
				  || ' | ' || e.title || ' ' || e.online || ' ' || e.city || ' ' || to_char(e.starts_at at time zone 'UTC', 'DD HH24:MI')
				from program p join program_event e on e.program_id = p.id where p.id = ?""")
			.param(partner.programId())
			.query(String.class)
			.single()).isEqualTo("Partner night II | Partners meet. | An evening with the partners.\n\n**Where:** 8 "
					+ "Nguyễn Huệ | 2099-11-21 | https://partner.test/night-2 | Partner night II false Ho Chi Minh City "
					+ "21 13:00");

		// What only Luma has, a place without the text it sits in, new times without a zone, a link to an event
		// that has its own page, and a program that is not an event are refused.
		assertThatThrownBy(() -> changes.change(operator(), page, new EventChanges.Change(null, null, null, null, null,
				null, null, null, 30, null, null, "public", null, null, true, null, null, null, null)))
			.hasMessageContaining("capacity, visibility");
		assertThatThrownBy(() -> changes.change(operator(), page, new EventChanges.Change(null, null, null, null,
				"8 Nguyễn Huệ", null, null, null, null, null, null, null, null, null, true, null, null, null, null)))
			.hasMessageContaining("description too");
		assertThatThrownBy(() -> changes.change(operator(), page,
				startingAt(Instant.parse("2099-11-22T13:00:00Z"), null)))
			.hasMessageContaining("timezone");
		onCalendar("[TEST] GenAI Builders Meetup Singapore", "f2jpv3fl", "private");
		assertThatThrownBy(() -> changes.change(operator(), page, new EventChanges.Change(null, null, null, null, null,
				null, null, null, null, null, null, null, null, null, true, null, null, null, "https://lu.ma/f2jpv3fl")))
			.hasMessageContaining("own page");
		jdbc.sql("update program set type = 'hackathon' where id = ?").param(partner.programId()).update();
		assertThatThrownBy(() -> changes.change(operator(), page, renamed())).hasMessageContaining("not an event");
		assertThat(jdbc.sql("select count(*) from audit_event where action = 'program.update' and resource_id = ?")
			.param(String.valueOf(partner.programId()))
			.query(Integer.class)
			.single()).isEqualTo(2);
	}

	@Test
	void theGuestsOfAnEventAreReadWithTheirAnswersAndOneIsDecidedOnLuma() {
		onCalendar("[TEST] GenAI Builders Meetup Singapore", "f2jpv3fl", "private");
		EventCreation.CreatedEvent found = creation.fromLuma(operator(), EVENT);
		jdbc.sql("""
				insert into program_luma_registration (id, program_id, account_id, email, name, answers, form_version,
				  status, send_state, ticket)
				values (?, ?, ?, 'Linh@Startup.test', 'Linh', '[]', 'v', 'pending_approval', 'sent', ?)""")
			.params(UUID.randomUUID(), found.programId(), operator().accountId(), UUID.randomUUID().toString())
			.update();
		ANSWERS.put("GET /v1/events/guests/list", """
				{"entries":[{"guest":{"id":"gst-linh","user_email":"linh@startup.test","user_name":"Linh",
				"approval_status":"pending_approval","registered_at":"2099-10-01T03:00:00Z","registration_answers":[
				{"label":"Your role","question_id":"q-role","value":"Founder","question_type":"select"},
				{"label":"Company","question_id":"q-co","value":{"company":"Startup","job_title":"CEO"},"question_type":"company"},
				{"label":"Topics","question_id":"q-t","value":["Agents","RAG"],"question_type":"select","multiple":true},
				{"label":"Code of conduct","question_id":"q-c","value":true,"question_type":"agree-check"},
				{"label":"Anything else?","question_id":"q-x","value":null,"question_type":"text"}]}},
				{"guest":{"id":"gst-minh","user_email":"minh@corp.test","user_name":"Minh","approval_status":"approved"}},
				{"guest":{"user_email":"no-id@corp.test","approval_status":"approved"}}],"has_more":false}""");

		// Each guest with what they answered written out, and whether they registered here; one without an id is left out.
		EventGuests.GuestList list = guests.guests(operator(), "program:" + found.slug(), null);
		assertThat(list.guests()).extracting(EventGuests.Guest::id).containsExactly("gst-linh", "gst-minh");
		EventGuests.Guest linh = list.guests().getFirst();
		assertThat(linh.here()).isTrue();
		assertThat(linh.registeredAt()).isEqualTo(Instant.parse("2099-10-01T03:00:00Z"));
		assertThat(linh.answers()).extracting(EventGuests.Answer::answer)
			.containsExactly("Founder", "Startup, CEO", "Agents; RAG", "yes");
		assertThat(list.guests().get(1).here()).isFalse();

		// Approved with a note, which Luma emails; recorded on the program without the guest's address.
		ANSWERS.put("GET /v1/events/guests/get", """
				{"guest":{"id":"gst-linh","user_email":"linh@startup.test","approval_status":"pending_approval"}}""");
		ANSWERS.put("POST /v1/events/guests/update-status", "{}");
		EventGuests.Decided decided = guests.decide(operator(), EVENT, "linh@startup.test", "approved", "See you there!",
				true);
		assertThat(decided.before()).isEqualTo("pending_approval");
		assertThat(decided.status()).isEqualTo("approved");
		assertThat(BODIES).anySatisfy(body -> assertThat(body).isEqualTo("POST /v1/events/guests/update-status "
				+ "{\"event_id\":\"" + EVENT + "\",\"guest_id\":\"gst-linh\",\"status\":\"approved\","
				+ "\"send_email\":true,\"message\":\"See you there!\"}"));
		assertThat(jdbc.sql("select (details ->> 'guest') || ' ' || (details ->> 'status') || ' ' || (details::text not like '%@%') from audit_event where action = ? and resource_id = ?")
			.params("program.luma_guest_decide", String.valueOf(found.programId()))
			.query(String.class)
			.single()).isEqualTo("gst-linh approved true");

		// The same status again sends nothing; what Luma does not take, or a guest it does not have, is said back.
		ANSWERS.put("GET /v1/events/guests/get", """
				{"guest":{"id":"gst-linh","user_email":"linh@startup.test","approval_status":"approved"}}""");
		assertThat(guests.decide(operator(), EVENT, "gst-linh", "approved", null, true).emailed()).isFalse();
		assertThatThrownBy(() -> guests.decide(operator(), EVENT, "gst-linh", "invited", null, true))
			.hasMessageContaining("approved, declined");
		assertThatThrownBy(() -> guests.decide(operator(), EVENT, "gst-linh", "declined", "x".repeat(201), true))
			.hasMessageContaining("200");
		ANSWERS.put("POST /v1/events/guests/update-status", "!400");
		assertThatThrownBy(() -> guests.decide(operator(), EVENT, "gst-linh", "declined", null, false))
			.isInstanceOfSatisfying(BusinessException.class,
					refused -> assertThat(refused.code()).isEqualTo("PROGRAM_LUMA_EVENT_REFUSED"));
		ANSWERS.remove("GET /v1/events/guests/get");
		assertThatThrownBy(() -> guests.decide(operator(), EVENT, "nobody@corp.test", "approved", null, true))
			.hasMessageContaining("no guest");
		EventCreation.CreatedEvent partner = creation.here(operator(), withRegistration("https://partner.test/night"));
		assertThatThrownBy(() -> guests.guests(operator(), partner.slug(), null))
			.hasMessageContaining("BeyondPilot alone");
		assertThat(BODIES.stream().filter(body -> body.startsWith("POST /v1/events/guests/update-status"))).hasSize(2);
	}

	@Test
	void anEventTakesACoverFromLumasGalleryAndApprovalIsTurnedOffOnItsTickets() {
		onCalendar("[TEST] GenAI Builders Meetup Singapore", "f2jpv3fl", "private");
		EventCreation.CreatedEvent found = creation.fromLuma(operator(), EVENT);
		ANSWERS.put("GET /v1/images/search", """
				{"entries":[{"id":"img-1","image_url":"https://images.lumacdn.com/gallery/agents.png","description":"Robots"},
				{"id":"img-2"}],"has_more":false}""");
		assertThat(changes.covers(operator(), "AI agents")).containsExactly(
				new EventChanges.Cover("https://images.lumacdn.com/gallery/agents.png", "Robots"));

		ANSWERS.put("POST /v1/events/update", "{}");
		ANSWERS.put("GET /v1/events/ticket-types/list", """
				{"entries":[{"id":"ttype-std","name":"Standard","require_approval":true},
				{"id":"ttype-vip","name":"VIP","require_approval":true,"is_hidden":true}]}""");
		ANSWERS.put("POST /v1/events/ticket-types/update", "{}");
		assertThatThrownBy(() -> changes.change(operator(), EVENT, covered("https://example.com/cover.png", null)))
			.hasMessageContaining("images.lumacdn.com");

		// Approval alone changes the tickets, every one, and not the event.
		changes.change(operator(), EVENT, covered(null, false));
		assertThat(BODIES).noneMatch(body -> body.startsWith("POST /v1/events/update"));
		assertThat(BODIES.stream().filter(body -> body.startsWith("POST /v1/events/ticket-types/update")))
			.containsExactlyInAnyOrder(
					"POST /v1/events/ticket-types/update {\"event_ticket_type_id\":\"ttype-std\",\"require_approval\":false}",
					"POST /v1/events/ticket-types/update {\"event_ticket_type_id\":\"ttype-vip\",\"require_approval\":false}");

		EventChanges.ChangedEvent changed = changes.change(operator(), "program:" + found.slug(),
				covered("https://images.lumacdn.com/gallery/agents.png", null));
		assertThat(changed.changed()).containsExactly("cover_url");
		assertThat(BODIES.stream().filter(body -> body.startsWith("POST /v1/events/update")).findFirst().orElseThrow())
			.contains("\"cover_url\":\"https://images.lumacdn.com/gallery/agents.png\"");
	}

	private static EventChanges.Change covered(@Nullable String cover, @Nullable Boolean approval) {
		return new EventChanges.Change(null, null, null, null, null, null, null, null, null, null, null, null, approval,
				cover, true, null, null, null, null);
	}

	private static EventChanges.Change nothing() {
		return new EventChanges.Change(null, null, null, null, null, null, null, null, null, null, null, null, null, null, true,
				null, null, null, null);
	}

	private static EventChanges.Change renamed() {
		return new EventChanges.Change("Renamed", null, null, null, null, null, null, null, null, null, null, null, null, null,
				true, null, null, null, null);
	}

	private static EventChanges.Change startingAt(@Nullable Instant starts, @Nullable Instant ends) {
		return new EventChanges.Change(null, starts, ends, null, null, null, null, null, null, null, null, null, null, null, true,
				null, null, null, null);
	}

	/** The calendar holds one event GenAI Fund manages, with a question, read in full and listed. */
	private static void onCalendar(String name, String address, String visibility) {
		String event = """
				{"id":"%s","name":"%s","start_at":"2099-11-19T10:00:00Z","end_at":"2099-11-19T12:00:00Z",
				"timezone":"Asia/Singapore","location_type":"offline","url":"https://luma.com/%s","visibility":"%s",
				"access":"manage","display_price":null,"registration_open":true,"require_approval":true,
				"spots_remaining":40,"waitlist_status":"enabled","hosts":[{"name":"GenAI Fund"}],
				"registration_questions":[{"id":"q-role","label":"Your role","required":true,"question_type":"select",
				"options":["Founder","Investor"],"multiple":false}]}""".formatted(EVENT, name, address, visibility);
		ANSWERS.put("GET /v1/events/get", "{\"event\":" + event + "}");
		ANSWERS.put("GET /v1/calendars/events/list", "{\"entries\":[{\"event\":" + event + "}]}");
	}

	private static EventCreation.NewEvent withRegistration(String registration) {
		return new EventCreation.NewEvent("Partner night", Instant.parse("2099-11-20T11:00:00Z"), null,
				ZoneId.of("Asia/Ho_Chi_Minh"), null, "Ho Chi Minh City", "Vietnam", null, null, null, false, null,
				false, false, List.of(), registration);
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
