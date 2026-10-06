package ai.genaifund.beyondpilot.notification.adapter;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Map;

import ai.genaifund.beyondpilot.notification.NotificationProperties;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * The setup checks read from Resend's API, against a server that answers as Resend does (resend.com/docs/api-reference
 * /domains): the domain list, one domain with its records, and the refusal of a sending-only key.
 */
class ResendEmailAdapterTest {

	private static final String DOMAINS = """
			{"object":"list","has_more":false,"data":[
			 {"id":"d91cd9bd","name":"elsewhere.example","status":"verified","created_at":"2026-10-01","region":"us-east-1"},
			 {"id":"4dd369bc","name":"beyondpilot.ai","status":"pending","created_at":"2026-10-06","region":"ap-northeast-1"}]}
			""";

	private static final String DOMAIN = """
			{"object":"domain","id":"4dd369bc","name":"beyondpilot.ai","status":"pending","created_at":"2026-10-06",
			 "region":"ap-northeast-1","records":[
			 {"record":"SPF","name":"send","type":"MX","ttl":"Auto","status":"verified","value":"feedback-smtp.ap-northeast-1.amazonses.com","priority":10},
			 {"record":"SPF","name":"send","type":"TXT","ttl":"Auto","status":"verified","value":"v=spf1 include:amazonses.com ~all"},
			 {"record":"DKIM","name":"resend._domainkey","type":"TXT","ttl":"Auto","status":"pending","value":"p=dkim-public-key-of-the-test"}]}
			""";

	private HttpServer server;

	@AfterEach
	void stop() {
		server.stop(0);
	}

	@Test
	void aPendingDomainListsEachRecordWithWhatResendFound() throws IOException {
		ResendEmailAdapter adapter = adapterAnswering(Map.of("/domains", answer(200, DOMAINS), "/domains/4dd369bc",
				answer(200, DOMAIN)));

		EmailSetup setup = adapter.inspect(new EmailConnection.ResendConnection("re_test"), "beyondpilot.ai");

		assertThat(setup.limit()).isNull();
		assertThat(setup.checks()).containsExactly(
				new EmailSetup.Check(EmailSetup.Step.CREDENTIALS, EmailSetup.State.OK),
				new EmailSetup.Check(EmailSetup.Step.DOMAIN_ADDED, EmailSetup.State.OK),
				new EmailSetup.Check(EmailSetup.Step.DOMAIN_VERIFIED, EmailSetup.State.PENDING),
				new EmailSetup.Check(EmailSetup.Step.DKIM, EmailSetup.State.PENDING));
		assertThat(setup.records()).containsExactly(
				new EmailSetup.DnsRecord("spf", "MX", "send", "feedback-smtp.ap-northeast-1.amazonses.com", 10,
						EmailSetup.State.OK),
				new EmailSetup.DnsRecord("spf", "TXT", "send", "v=spf1 include:amazonses.com ~all", null,
						EmailSetup.State.OK),
				new EmailSetup.DnsRecord("dkim", "TXT", "resend._domainkey", "p=dkim-public-key-of-the-test", null,
						EmailSetup.State.PENDING));
	}

	@Test
	void aDomainNotAddedIsTheStepThatFails() throws IOException {
		ResendEmailAdapter adapter = adapterAnswering(Map.of("/domains", answer(200, DOMAINS)));

		EmailSetup setup = adapter.inspect(new EmailConnection.ResendConnection("re_test"), "genaifund.ai");

		assertThat(setup.checks()).containsExactly(
				new EmailSetup.Check(EmailSetup.Step.CREDENTIALS, EmailSetup.State.OK),
				new EmailSetup.Check(EmailSetup.Step.DOMAIN_ADDED, EmailSetup.State.FAILED));
		assertThat(setup.records()).isEmpty();
	}

	@Test
	void aSendingOnlyKeySaysItCannotReadRatherThanFailing() throws IOException {
		ResendEmailAdapter adapter = adapterAnswering(Map.of("/domains", answer(401,
				"{\"statusCode\":401,\"name\":\"restricted_api_key\",\"message\":\"This API key is restricted to only send emails\"}")));

		EmailSetup setup = adapter.inspect(new EmailConnection.ResendConnection("re_test"), "beyondpilot.ai");

		assertThat(setup.limit()).isEqualTo(EmailSetup.Limit.PERMISSION_MISSING);
		assertThat(setup.checks()).isEmpty();
	}

	private record Answer(int status, String body) {
	}

	private static Answer answer(int status, String body) {
		return new Answer(status, body);
	}

	private ResendEmailAdapter adapterAnswering(Map<String, Answer> answers) throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/", exchange -> {
			Answer answer = answers.getOrDefault(exchange.getRequestURI().getPath(), answer(404, "{}"));
			byte[] body = answer.body().getBytes(UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json");
			exchange.sendResponseHeaders(answer.status(), body.length);
			exchange.getResponseBody().write(body);
			exchange.close();
		});
		server.start();
		String url = "http://127.0.0.1:" + server.getAddress().getPort();
		return new ResendEmailAdapter(new NotificationProperties(null, "http://localhost:3000",
				new NotificationProperties.Resend(url)));
	}

}
