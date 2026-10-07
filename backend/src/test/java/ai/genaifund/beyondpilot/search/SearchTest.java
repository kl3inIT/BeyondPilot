package ai.genaifund.beyondpilot.search;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.net.URI;
import java.time.Duration;
import java.time.LocalDate;
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
 * Search over real HTTP against PostgreSQL, fed the way it is in production: an operator publishes a program and a
 * visitor finds it without a session, the program leaves the results when it is taken down, and the repair puts back
 * what a missed delivery left out. Only the SMTP server is replaced.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@search.test")
@Import({ TestcontainersConfiguration.class, SearchTest.Mail.class })
class SearchTest {

	private static final String PROGRAMS = "/api/program/admin/programs";

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private IndexRepair repair;

	private RestTestClient client;

	/** A word only this test's programs carry, so other tests' programs never match. */
	private String word;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
		word = "zq" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
	}

	@Test
	void aPublishedProgramIsFoundAndLeavesTheResultsWhenTakenDown() {
		String operator = TestSignIn.session(client, mail, "operator@search.test");
		String program = created(operator, "Thử thách Bảo hiểm " + word, "bao-hiem-" + word);
		Map<String, Object> details = program(0, "Thử thách Bảo hiểm " + word, "bao-hiem-" + word);
		details.put("partnerName", "Tasco Insurance");
		details.put("summary", "Insurers name what they need; providers answer.");
		details.put("coverFileId", storedImage("operator@search.test"));
		details.put("startsOn", LocalDate.now().plusDays(10).toString());
		details.put("endsOn", LocalDate.now().plusDays(40).toString());
		save(operator, program, details);
		// A draft is never in the index.
		assertThat(total("bao hiem " + word)).isZero();

		command(operator, program, "publish");
		await().atMost(Duration.ofSeconds(10)).until(() -> total("bao hiem " + word) == 1);

		String body = search("?q=" + "bao%20hiem%20" + word);
		assertThat(JsonPath.<Integer>read(body, "$.counts.program")).isEqualTo(1);
		assertThat(JsonPath.<String>read(body, "$.items[0].kind")).isEqualTo("program");
		assertThat(JsonPath.<String>read(body, "$.items[0].slug")).isEqualTo("bao-hiem-" + word);
		assertThat(JsonPath.<String>read(body, "$.items[0].subtitle")).isEqualTo("Tasco Insurance");
		assertThat(JsonPath.<String>read(body, "$.items[0].type")).isEqualTo("event");
		assertThat(JsonPath.<String>read(body, "$.items[0].phase")).isEqualTo("upcoming");
		assertThat(JsonPath.<String>read(body, "$.items[0].coverFileId")).isNotBlank();
		// The partner is found as well as the title, and the start of a word.
		assertThat(total("tasco " + word)).isEqualTo(1);
		assertThat(total(word.substring(0, 6))).isEqualTo(1);

		command(operator, program, "unpublish");
		await().atMost(Duration.ofSeconds(10)).until(() -> total("bao hiem " + word) == 0);
		// Every delivery completed, so the registry holds nothing for these changes.
		await().atMost(Duration.ofSeconds(10))
			.until(() -> jdbc.sql("select count(*) from event_publication").query(Long.class).single() == 0);
	}

	@Test
	void theRepairPutsBackWhatAMissedDeliveryLeftOutAndTakesOutWhatIsGone() {
		UUID missed = UUID.randomUUID();
		jdbc.sql("""
				insert into program (id, slug, name, type, summary, starts_on, ends_on, status, published_at)
				values (?, ?, ?, 'hackathon', 'Two days of building.', current_date, current_date + 2, 'published', now())
				""").params(missed, "missed-" + word, "Missed " + word).update();
		UUID gone = UUID.randomUUID();
		jdbc.sql("""
				insert into search_document (kind, item_id, slug, title, summary, keywords, card, listed)
				values ('program', ?, ?, ?, '', '', '', true)
				""").params(gone, "gone-" + word, "Gone " + word).update();

		repair.repair();

		String body = search("?q=" + word);
		assertThat(JsonPath.<List<String>>read(body, "$.items[*].slug")).containsExactly("missed-" + word);
	}

	@Test
	void aQueryThatIsMissingOrTooLongOrAPageOutOfRangeIsAValidationProblem() {
		String body = new String(client.get()
			.uri(URI.create("http://localhost:" + port + "/api/search?q=" + "a".repeat(101) + "&kind=usecase&page=51"))
			.exchange()
			.expectStatus()
			.isBadRequest()
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8);
		assertThat(JsonPath.<List<String>>read(body, "$.errors[*].pointer")).containsExactlyInAnyOrder("#/q", "#/kind",
				"#/page");

		client.get().uri("/api/search").exchange().expectStatus().isBadRequest();
		client.get()
			.uri(URI.create("http://localhost:" + port + "/api/search?q=%20%20"))
			.exchange()
			.expectStatus()
			.isBadRequest();
	}

	private long total(String query) {
		return JsonPath.<Number>read(search("?q=" + query.replace(" ", "%20")), "$.total").longValue();
	}

	private String search(String parameters) {
		return new String(client.get()
			.uri(URI.create("http://localhost:" + port + "/api/search" + parameters))
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.returnResult()
			.getResponseBody(), UTF_8);
	}

	private String created(String session, String name, String slug) {
		String body = client.post()
			.uri(PROGRAMS)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", name, "slug", slug, "type", "event"))
			.exchange()
			.expectStatus()
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

	private void save(String session, String uri, Map<String, Object> program) {
		client.put()
			.uri(uri)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(program)
			.exchange()
			.expectStatus()
			.isOk();
	}

	private void command(String session, String uri, String command) {
		client.post()
			.uri(uri + "/" + command)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isNoContent();
	}

	/** The record of a stored cover; the save reads the record, never the bytes. */
	private UUID storedImage(String uploader) {
		UUID id = UUID.randomUUID();
		jdbc.sql("""
				insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type,
				                          size_bytes, status, uploaded_by_account_id, upload_expires_at)
				select ?, 'local', ?, 'program_image', true, 'cover.png', 'image/png', 2048, 'stored', id, now()
				from identity_account where email = ?
				""").params(id, "test/" + id, uploader).update();
		return id;
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
