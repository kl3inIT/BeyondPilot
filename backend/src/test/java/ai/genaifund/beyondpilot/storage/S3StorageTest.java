package ai.genaifund.beyondpilot.storage;

import static ai.genaifund.beyondpilot.storage.StorageTestSupport.JSON;
import static ai.genaifund.beyondpilot.storage.StorageTestSupport.confirm;
import static ai.genaifund.beyondpilot.storage.StorageTestSupport.pdf;
import static ai.genaifund.beyondpilot.storage.StorageTestSupport.png;
import static ai.genaifund.beyondpilot.storage.StorageTestSupport.ticket;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

/**
 * The same three requests with the S3 object store, against MinIO in a container: the test plays the browser and
 * sends the bytes to the presigned address, so they never reach the application.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "beyondpilot.identity.operator-emails=operator@storage.test", "beyondpilot.storage.provider=s3",
				"beyondpilot.storage.s3.bucket=beyondpilot-test", "beyondpilot.storage.s3.region=us-east-1" })
@Import({ TestcontainersConfiguration.class, S3StorageTest.Mail.class })
class S3StorageTest {

	private static final String BUCKET = "beyondpilot-test";

	// Chainguard's build of MinIO, pinned by digest: MinIO no longer publishes its own image.
	private static final GenericContainer<?> MINIO = new GenericContainer<>(DockerImageName.parse(
			"cgr.dev/chainguard/minio@sha256:4cf4831a2bbcf13ddca09c1cbcc9faff716dd3c4247e0babc32864b8ee8e0034"))
		.withEnv("MINIO_ROOT_USER", "storage-test")
		.withEnv("MINIO_ROOT_PASSWORD", "storage-test-secret")
		.withCommand("server", "/tmp/data")
		.withExposedPorts(9000)
		.waitingFor(Wait.forHttp("/minio/health/live").forPort(9000));

	private static final HttpClient BROWSER = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private StorageService storage;

	private RestTestClient client;

	@DynamicPropertySource
	static void bucket(DynamicPropertyRegistry registry) {
		MINIO.start();
		// The adapter takes its credentials from the SDK's default chain, as it does on AWS.
		System.setProperty("aws.accessKeyId", "storage-test");
		System.setProperty("aws.secretAccessKey", "storage-test-secret");
		URI endpoint = URI.create("http://" + MINIO.getHost() + ":" + MINIO.getMappedPort(9000));
		try (S3Client s3 = S3Client.builder()
			.region(Region.US_EAST_1)
			.endpointOverride(endpoint)
			.forcePathStyle(true)
			.build()) {
			s3.createBucket(create -> create.bucket(BUCKET));
		}
		registry.add("beyondpilot.storage.s3.endpoint", endpoint::toString);
	}

	@AfterAll
	static void stop() {
		System.clearProperty("aws.accessKeyId");
		System.clearProperty("aws.secretAccessKey");
		MINIO.stop();
	}

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
	}

	@Test
	void theBrowserSendsAnImageStraightToTheBucketAndReadsItThroughARedirect() throws Exception {
		String operator = TestSignIn.session(client, mail, "operator@storage.test");
		byte[] image = png(4096);

		Map<String, Object> ticket = ticket(client, operator, "program_image", "cover.png", "image/png", image.length);
		assertThat((String) ticket.get("url")).startsWith("http://" + MINIO.getHost() + ":" + MINIO.getMappedPort(9000)
				+ "/" + BUCKET + "/program_image/").contains("X-Amz-Signature=");
		assertThat(ticket.get("headers")).isEqualTo(Map.of(HttpHeaders.CONTENT_TYPE, "image/png"));

		assertThat(put(ticket, "image/png", image)).isEqualTo(200);
		confirm(client, operator, ticket.get("id")).expectStatus().isOk();

		HttpResponse<byte[]> redirect = BROWSER.send(HttpRequest
			.newBuilder(URI.create("http://localhost:" + port + "/api/storage/files/" + ticket.get("id")))
			.build(), HttpResponse.BodyHandlers.ofByteArray());
		assertThat(redirect.statusCode()).isEqualTo(302);
		assertThat(redirect.headers().firstValue(HttpHeaders.CACHE_CONTROL)).hasValue("max-age=1800, private");
		HttpResponse<byte[]> read = BROWSER.send(
				HttpRequest.newBuilder(URI.create(redirect.headers().firstValue(HttpHeaders.LOCATION).orElseThrow()))
					.build(),
				HttpResponse.BodyHandlers.ofByteArray());
		assertThat(read.statusCode()).isEqualTo(200);
		assertThat(read.headers().firstValue(HttpHeaders.CONTENT_TYPE)).hasValue("image/png");
		assertThat(read.headers().firstValue(HttpHeaders.CONTENT_DISPOSITION)).hasValue("inline");
		assertThat(read.body()).isEqualTo(image);
	}

	@Test
	void theBucketRefusesBytesThatAreNotTheAnnouncedFile() throws Exception {
		String applicant = TestSignIn.session(client, mail, "applicant@storage.test");
		byte[] deck = pdf(1500);

		Map<String, Object> ticket = ticket(client, applicant, "application_file", "deck.pdf", "application/pdf",
				deck.length);
		problem(confirm(client, applicant, ticket.get("id")), 409, "STORAGE_UPLOAD_MISSING");

		assertThat(put(ticket, "application/pdf", pdf(1501))).as("a longer body than was signed").isEqualTo(403);
		assertThat(put(ticket, "image/png", deck)).as("another media type than was signed").isEqualTo(403);
		problem(confirm(client, applicant, ticket.get("id")), 409, "STORAGE_UPLOAD_MISSING");

		Map<String, Object> disguised = ticket(client, applicant, "application_file", "deck.pdf", "application/pdf",
				deck.length);
		assertThat(put(disguised, "application/pdf", png(1500))).isEqualTo(200);
		problem(confirm(client, applicant, disguised.get("id")), 400, "STORAGE_CONTENT_MISMATCH");
		assertThat(put(ticket, "application/pdf", deck)).isEqualTo(200);
		confirm(client, applicant, ticket.get("id")).expectStatus().isOk();

		// A private file is read by the module that owns it, as a download under its own name.
		UUID id = UUID.fromString((String) ticket.get("id"));
		problem(client.get().uri("/api/storage/files/{id}", id).exchange(), 404, "STORAGE_FILE_NOT_FOUND");
		FileDownload download = storage.download(id);
		assertThat(download.content()).isNull();
		assertThat(download.redirectLifetime()).isEqualTo(Duration.ofHours(1));
		URI address = download.redirect();
		assertThat(address).isNotNull();
		HttpResponse<byte[]> read = BROWSER.send(HttpRequest.newBuilder(address).build(),
				HttpResponse.BodyHandlers.ofByteArray());
		assertThat(read.statusCode()).isEqualTo(200);
		assertThat(read.headers().firstValue(HttpHeaders.CONTENT_DISPOSITION))
			.hasValue("attachment; filename=\"deck.pdf\"");
		assertThat(read.body()).isEqualTo(deck);

		storage.delete(id);
		assertThat(BROWSER.send(HttpRequest.newBuilder(address).build(), HttpResponse.BodyHandlers.discarding())
			.statusCode()).isEqualTo(404);
	}

	/** Sends the bytes as a browser would: to the address of the ticket, with the header it names. */
	private static int put(Map<String, Object> ticket, String contentType, byte[] content)
			throws IOException, InterruptedException {
		return BROWSER.send(HttpRequest.newBuilder(URI.create((String) ticket.get("url")))
			.header(HttpHeaders.CONTENT_TYPE, contentType)
			.PUT(HttpRequest.BodyPublishers.ofByteArray(content))
			.build(), HttpResponse.BodyHandlers.discarding()).statusCode();
	}

	private static void problem(RestTestClient.ResponseSpec response, int status, String code) {
		Map<String, Object> problem = response.expectStatus()
			.isEqualTo(status)
			.expectBody(JSON)
			.returnResult()
			.getResponseBody();
		assertThat(problem).containsEntry("code", code);
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
