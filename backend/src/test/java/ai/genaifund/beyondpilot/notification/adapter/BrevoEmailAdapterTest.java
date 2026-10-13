package ai.genaifund.beyondpilot.notification.adapter;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import ai.genaifund.beyondpilot.notification.NotificationProperties;
import ai.genaifund.beyondpilot.notification.adapter.EmailDeliveryException.DeliveryFailure;
import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * Sending and the setup checks through Brevo's Java SDK, against a server that answers as Brevo documents
 * (developers.brevo.com/reference/sendtransacemail and /reference/getdomainconfiguration). The SDK is generated for
 * OkHttp 4 and runs here on the OkHttp the build resolves, so these tests are also the proof that it sends a request
 * and reads an answer on it.
 */
class BrevoEmailAdapterTest {

	private static final EmailConnection.BrevoConnection CONNECTION = new EmailConnection.BrevoConnection(
			"brevo-key-of-the-test");

	private static final String DOMAIN = """
			{"domain":"beyondpilot.ai","verified":true,"authenticated":false,"dns_records":{
			 "dkim_record":{"type":"TXT","value":"k=rsa;p=dkim-public-key-of-the-test","host_name":"mail._domainkey","status":false},
			 "brevo_code":{"type":"TXT","value":"brevo-code:code-of-the-test","host_name":"@","status":true},
			 "dmarc_record":{"type":"TXT","value":"v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com","host_name":"_dmarc","status":false}}}
			""";

	private final Map<String, String> asked = new ConcurrentHashMap<>();

	private HttpServer server;

	@AfterEach
	void stop() {
		if (server != null) {
			server.stop(0);
		}
	}

	@Test
	void anEmailIsHandedOverWithTheKeyAndNamedAsBrevoNamesIt() throws IOException {
		BrevoEmailAdapter adapter = adapterAnswering(Map.of("/v3/smtp/email",
				answer(201, "{\"messageId\":\"<202610110800.12345678901@smtp-relay.mailin.fr>\"}")));

		EmailResult result = adapter.send(request("answers@beyondpilot.ai"), CONNECTION);

		// The angle brackets of the answer are dropped, so a report that names the message without them finds it.
		assertThat(result.providerMessageId()).isEqualTo("202610110800.12345678901@smtp-relay.mailin.fr");
		assertThat(asked.get("method")).isEqualTo("POST");
		assertThat(asked.get("api-key")).isEqualTo("brevo-key-of-the-test");
		String sent = asked.get("body");
		assertThat(JsonPath.<String>read(sent, "$.sender.name")).isEqualTo("BeyondPilot");
		assertThat(JsonPath.<String>read(sent, "$.sender.email")).isEqualTo("no-reply@beyondpilot.ai");
		assertThat(JsonPath.<String>read(sent, "$.replyTo.email")).isEqualTo("answers@beyondpilot.ai");
		assertThat(JsonPath.<String>read(sent, "$.to[0].email")).isEqualTo("person@email.test");
		assertThat(JsonPath.<String>read(sent, "$.subject")).isEqualTo("Hello");
		assertThat(JsonPath.<String>read(sent, "$.htmlContent")).isEqualTo("<p>Hello</p>");
		assertThat(JsonPath.<String>read(sent, "$.textContent")).isEqualTo("Hello");
	}

	@Test
	void aRefusalIsTypedByItsStatusSoTheQueueKnowsWhetherToTryAgain() throws IOException {
		Map<Integer, DeliveryFailure> expected = Map.of(401, DeliveryFailure.AUTHENTICATION, 403,
				DeliveryFailure.AUTHENTICATION, 429, DeliveryFailure.THROTTLED, 500, DeliveryFailure.UNAVAILABLE, 400,
				DeliveryFailure.REJECTED);
		for (Map.Entry<Integer, DeliveryFailure> refusal : expected.entrySet()) {
			stop();
			BrevoEmailAdapter adapter = adapterAnswering(Map.of("/v3/smtp/email",
					answer(refusal.getKey(), "{\"code\":\"invalid_parameter\",\"message\":\"text of Brevo\"}")));

			EmailDeliveryException refused = catchThrowableOfType(EmailDeliveryException.class,
					() -> adapter.send(request(null), CONNECTION));

			assertThat(refused.failure()).as("status %s", refusal.getKey()).isEqualTo(refusal.getValue());
			assertThat(refused.getMessage()).doesNotContain("text of Brevo");
		}
	}

	@Test
	void aServerThatDoesNotAnswerIsUnavailable() throws IOException {
		BrevoEmailAdapter adapter = adapterAnswering(Map.of());
		server.stop(0);

		EmailDeliveryException refused = catchThrowableOfType(EmailDeliveryException.class,
				() -> adapter.send(request(null), CONNECTION));

		assertThat(refused.failure()).isEqualTo(DeliveryFailure.UNAVAILABLE);
	}

	@Test
	void aDomainListsItsThreeRecordsWithWhatBrevoFound() throws IOException {
		BrevoEmailAdapter adapter = adapterAnswering(Map.of("/v3/senders/domains/beyondpilot.ai", answer(200, DOMAIN)));

		EmailSetup setup = adapter.inspect(CONNECTION, "beyondpilot.ai");

		assertThat(asked.get("api-key")).isEqualTo("brevo-key-of-the-test");
		assertThat(setup.limit()).isNull();
		assertThat(setup.checks()).containsExactly(
				new EmailSetup.Check(EmailSetup.Step.CREDENTIALS, EmailSetup.State.OK),
				new EmailSetup.Check(EmailSetup.Step.DOMAIN_ADDED, EmailSetup.State.OK),
				new EmailSetup.Check(EmailSetup.Step.DOMAIN_VERIFIED, EmailSetup.State.OK),
				new EmailSetup.Check(EmailSetup.Step.DKIM, EmailSetup.State.PENDING));
		assertThat(setup.records()).containsExactly(
				new EmailSetup.DnsRecord("brevo_code", "TXT", "@", "brevo-code:code-of-the-test", null,
						EmailSetup.State.OK),
				new EmailSetup.DnsRecord("dkim", "TXT", "mail._domainkey", "k=rsa;p=dkim-public-key-of-the-test", null,
						EmailSetup.State.PENDING),
				new EmailSetup.DnsRecord("dmarc", "TXT", "_dmarc", "v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com",
						null, EmailSetup.State.PENDING));
	}

	@Test
	void aDomainNotAddedIsTheStepThatFails() throws IOException {
		BrevoEmailAdapter adapter = adapterAnswering(Map.of("/v3/senders/domains/genaifund.ai",
				answer(404, "{\"code\":\"document_not_found\",\"message\":\"Domain does not exist\"}")));

		EmailSetup setup = adapter.inspect(CONNECTION, "genaifund.ai");

		assertThat(setup.limit()).isNull();
		assertThat(setup.checks()).containsExactly(
				new EmailSetup.Check(EmailSetup.Step.CREDENTIALS, EmailSetup.State.OK),
				new EmailSetup.Check(EmailSetup.Step.DOMAIN_ADDED, EmailSetup.State.FAILED));
		assertThat(setup.records()).isEmpty();
	}

	@Test
	void aKeyBrevoRefusesSaysSoInsteadOfFailingEveryCheck() throws IOException {
		BrevoEmailAdapter adapter = adapterAnswering(Map.of("/v3/senders/domains/beyondpilot.ai",
				answer(401, "{\"code\":\"unauthorized\",\"message\":\"Key not found\"}")));

		EmailSetup setup = adapter.inspect(CONNECTION, "beyondpilot.ai");

		assertThat(setup.limit()).isEqualTo(EmailSetup.Limit.CREDENTIALS_REFUSED);
		assertThat(setup.checks()).isEmpty();
	}

	private static EmailRequest request(String replyTo) {
		return new EmailRequest(UUID.randomUUID(), "BeyondPilot", "no-reply@beyondpilot.ai", replyTo,
				"person@email.test", "Hello", "<p>Hello</p>", "Hello", "message_request");
	}

	private record Answer(int status, String body) {
	}

	private static Answer answer(int status, String body) {
		return new Answer(status, body);
	}

	private BrevoEmailAdapter adapterAnswering(Map<String, Answer> answers) throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/", exchange -> {
			asked.put("method", exchange.getRequestMethod());
			asked.put("api-key", String.valueOf(exchange.getRequestHeaders().getFirst("api-key")));
			asked.put("body", new String(exchange.getRequestBody().readAllBytes(), UTF_8));
			Answer answer = answers.getOrDefault(exchange.getRequestURI().getPath(), answer(404, "{}"));
			byte[] body = answer.body().getBytes(UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json");
			exchange.sendResponseHeaders(answer.status(), body.length);
			exchange.getResponseBody().write(body);
			exchange.close();
		});
		server.start();
		String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/v3";
		return new BrevoEmailAdapter(new NotificationProperties(null, "http://localhost:3000",
				new NotificationProperties.Resend("https://api.resend.com"), new NotificationProperties.Brevo(url)));
	}

}
