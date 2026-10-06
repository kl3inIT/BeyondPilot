package ai.genaifund.beyondpilot.storage;

import static ai.genaifund.beyondpilot.storage.StorageTestSupport.JSON;
import static ai.genaifund.beyondpilot.storage.StorageTestSupport.confirm;
import static ai.genaifund.beyondpilot.storage.StorageTestSupport.pdf;
import static ai.genaifund.beyondpilot.storage.StorageTestSupport.png;
import static ai.genaifund.beyondpilot.storage.StorageTestSupport.reserve;
import static ai.genaifund.beyondpilot.storage.StorageTestSupport.ticket;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.InputStreamSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Uploads over real HTTP against PostgreSQL with the local object store: the three requests, what a purpose refuses,
 * what a ticket refuses, and who can read a file.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "beyondpilot.identity.operator-emails=operator@storage.test",
				"beyondpilot.storage.provider=local", "beyondpilot.storage.program-image-max-size=64KB" })
@Import({ TestcontainersConfiguration.class, TestMailbox.Configuration.class })
class LocalStorageTest {

	private static final Path DIRECTORY = temporaryDirectory();

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private StorageService storage;

	private RestTestClient client;

	@DynamicPropertySource
	static void storageDirectory(DynamicPropertyRegistry registry) {
		registry.add("beyondpilot.storage.local.directory", DIRECTORY::toString);
	}

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
	}

	@Test
	void anOperatorUploadsAnImageInThreeRequestsAndAnyoneReadsIt() {
		String operator = signIn("operator@storage.test");
		byte[] image = png(2048);

		Map<String, Object> ticket = ticket(client, operator, "program_image", "C:\\covers\\cover.png", "image/png",
				image.length);
		assertThat(ticket.get("method")).isEqualTo("PUT");
		assertThat((String) ticket.get("url")).startsWith("/api/storage/uploads/" + ticket.get("id") + "/content?token=");

		send(operator, ticket, image).expectStatus().isNoContent();
		confirm(client, operator, ticket.get("id")).expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.fileName")
			.isEqualTo("cover.png")
			.jsonPath("$.mediaType")
			.isEqualTo("image/png")
			.jsonPath("$.sizeBytes")
			.isEqualTo(image.length);

		// No session: a visitor's browser reads the image, and may keep it.
		client.get()
			.uri("/api/storage/files/{id}", ticket.get("id"))
			.exchange()
			.expectStatus()
			.isOk()
			.expectHeader()
			.contentType(MediaType.IMAGE_PNG)
			.expectHeader()
			.valueEquals(HttpHeaders.CACHE_CONTROL, "max-age=31536000, public, immutable")
			.expectBody(byte[].class)
			.isEqualTo(image);
		assertThat(DIRECTORY.resolve(objectKey(ticket))).hasBinaryContent(image);
		// Confirming again changes nothing.
		confirm(client, operator, ticket.get("id")).expectStatus().isOk();
	}

	@Test
	void aMemberStoresTheirTalentPhoto() {
		String member = signIn("applicant@storage.test");
		byte[] image = png(2048);

		Map<String, Object> ticket = ticket(client, member, "talent_photo", "me.png", "image/png", image.length);
		send(member, ticket, image).expectStatus().isNoContent();
		confirm(client, member, ticket.get("id")).expectStatus().isOk();

		client.get().uri("/api/storage/files/{id}", ticket.get("id")).exchange().expectStatus().isOk();
	}

	@Test
	void aPurposeRefusesWhatItDoesNotAccept() {
		String operator = signIn("operator@storage.test");
		String applicant = signIn("applicant@storage.test");

		problem(reserve(client, operator, "program_image", "cover.svg", "image/svg+xml", 500), 400,
				"STORAGE_MEDIA_TYPE_NOT_ALLOWED");
		problem(reserve(client, operator, "program_image", "cover.png", "image/png", 64 * 1024 + 1), 400,
				"STORAGE_FILE_TOO_LARGE");
		problem(reserve(client, applicant, "program_image", "cover.png", "image/png", 500), 403,
				"STORAGE_UPLOAD_NOT_PERMITTED");
		reserve(client, applicant, "poster", "cover.png", "image/png", 500).expectStatus().isBadRequest();
		reserve(client, applicant, "application_file", "deck.pdf", "application/pdf", 0).expectStatus()
			.isBadRequest();
		client.post()
			.uri("/api/storage/uploads")
			.header(TestSignIn.CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("purpose", "application_file", "fileName", "deck.pdf", "mediaType", "application/pdf",
					"sizeBytes", 500))
			.exchange()
			.expectStatus()
			.isUnauthorized();
	}

	@Test
	void aFileIsNotStoredUntilItsBytesAreTheAnnouncedFile() {
		String applicant = signIn("applicant@storage.test");

		Map<String, Object> missing = ticket(client, applicant, "application_file", "deck.pdf", "application/pdf", 600);
		problem(confirm(client, applicant, missing.get("id")), 409, "STORAGE_UPLOAD_MISSING");

		Map<String, Object> disguised = ticket(client, applicant, "application_file", "deck.pdf", "application/pdf",
				600);
		send(applicant, disguised, png(600)).expectStatus().isNoContent();
		problem(confirm(client, applicant, disguised.get("id")), 400, "STORAGE_CONTENT_MISMATCH");
		assertThat(DIRECTORY.resolve(objectKey(disguised))).as("a refused upload is removed").doesNotExist();
		assertThat(status(disguised)).isEqualTo("pending");
	}

	@Test
	void aTicketWorksOnceForItsOwnerAndForTheAnnouncedLength() {
		String applicant = signIn("applicant@storage.test");
		String other = signIn("other@storage.test");
		byte[] deck = pdf(900);
		Map<String, Object> ticket = ticket(client, applicant, "application_file", "deck.pdf", "application/pdf",
				deck.length);

		problem(send(applicant, ticket, pdf(901)), 400, "STORAGE_CONTENT_MISMATCH");
		problem(send(other, ticket, deck), 404, "STORAGE_FILE_NOT_FOUND");
		problem(sendTo(applicant, "/api/storage/uploads/" + ticket.get("id") + "/content?token=guess", deck), 403,
				"STORAGE_TICKET_REFUSED");
		client.put()
			.uri((String) ticket.get("url"))
			.cookie(TestSignIn.SESSION_COOKIE, applicant)
			.contentType(MediaType.APPLICATION_PDF)
			.body(deck)
			.exchange()
			.expectStatus()
			.isForbidden();

		send(applicant, ticket, deck).expectStatus().isNoContent();
		problem(send(applicant, ticket, deck), 403, "STORAGE_TICKET_REFUSED");
		problem(confirm(client, other, ticket.get("id")), 404, "STORAGE_FILE_NOT_FOUND");
		confirm(client, applicant, ticket.get("id")).expectStatus().isOk();

		Map<String, Object> late = ticket(client, applicant, "application_file", "deck.pdf", "application/pdf",
				deck.length);
		jdbc.sql("update storage_file set upload_expires_at = now() - interval '1 second' where id = :id")
			.param("id", UUID.fromString((String) late.get("id")))
			.update();
		problem(send(applicant, late, deck), 410, "STORAGE_TICKET_EXPIRED");
	}

	@Test
	void aPrivateOrPendingFileIsNotServedByThePublicAddress() throws IOException {
		String applicant = signIn("applicant@storage.test");
		byte[] deck = pdf(700);
		Map<String, Object> ticket = ticket(client, applicant, "application_file", "deck.pdf", "application/pdf",
				deck.length);
		UUID id = UUID.fromString((String) ticket.get("id"));
		Actor uploader = new Actor(jdbc.sql("select uploaded_by_account_id from storage_file where id = :id")
			.param("id", id)
			.query(UUID.class)
			.single());

		problem(client.get().uri("/api/storage/files/{id}", id).exchange(), 404, "STORAGE_FILE_NOT_FOUND");
		assertThatThrownBy(() -> storage.stored(id, FilePurpose.APPLICATION_FILE, uploader))
			.isInstanceOf(StorageException.class);

		send(applicant, ticket, deck).expectStatus().isNoContent();
		confirm(client, applicant, id).expectStatus().isOk();
		problem(client.get().uri("/api/storage/files/{id}", id).exchange(), 404, "STORAGE_FILE_NOT_FOUND");

		// The owning module reads it after its own check of the reader, and names it when it saves its record.
		assertThat(storage.stored(id, FilePurpose.APPLICATION_FILE, uploader).fileName()).isEqualTo("deck.pdf");
		assertThatThrownBy(() -> storage.stored(id, FilePurpose.PROGRAM_IMAGE, uploader))
			.isInstanceOf(StorageException.class);
		assertThatThrownBy(() -> storage.stored(id, FilePurpose.APPLICATION_FILE, new Actor(UUID.randomUUID())))
			.isInstanceOf(StorageException.class);
		FileDownload download = storage.download(id);
		assertThat(download.attachment()).isTrue();
		assertThat(download.redirect()).isNull();
		InputStreamSource content = download.content();
		assertThat(content).isNotNull();
		try (InputStream bytes = content.getInputStream()) {
			assertThat(bytes.readAllBytes()).isEqualTo(deck);
		}

		Path stored = DIRECTORY.resolve(objectKey(ticket));
		assertThat(stored).exists();
		storage.delete(id);
		assertThat(stored).doesNotExist();
		assertThatThrownBy(() -> storage.download(id)).isInstanceOf(StorageException.class);
	}

	private String signIn(String email) {
		return TestSignIn.session(client, mail, email);
	}

	private RestTestClient.ResponseSpec send(String session, Map<String, Object> ticket, byte[] content) {
		return sendTo(session, (String) ticket.get("url"), content);
	}

	private RestTestClient.ResponseSpec sendTo(String session, String url, byte[] content) {
		return client.put()
			.uri(url)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_OCTET_STREAM)
			.body(content)
			.exchange();
	}

	private static void problem(RestTestClient.ResponseSpec response, int status, String code) {
		Map<String, Object> problem = response.expectStatus()
			.isEqualTo(status)
			.expectBody(JSON)
			.returnResult()
			.getResponseBody();
		assertThat(problem).containsEntry("code", code);
	}

	private String objectKey(Map<String, Object> ticket) {
		return jdbc.sql("select object_key from storage_file where id = :id")
			.param("id", UUID.fromString((String) ticket.get("id")))
			.query(String.class)
			.single();
	}

	private String status(Map<String, Object> ticket) {
		return jdbc.sql("select status from storage_file where id = :id")
			.param("id", UUID.fromString((String) ticket.get("id")))
			.query(String.class)
			.single();
	}

	private static Path temporaryDirectory() {
		try {
			return Files.createTempDirectory("beyondpilot-storage-");
		}
		catch (IOException exception) {
			throw new UncheckedIOException(exception);
		}
	}
}
