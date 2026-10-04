package ai.genaifund.beyondpilot.storage;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;

import ai.genaifund.beyondpilot.identity.TestSignIn;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;

/** What both storage tests do over HTTP: reserve an upload, confirm it, and make file content of a given length. */
final class StorageTestSupport {

	static final ParameterizedTypeReference<Map<String, Object>> JSON = new ParameterizedTypeReference<>() {
	};

	private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n' };

	private StorageTestSupport() {
	}

	static byte[] png(int length) {
		return startingWith(PNG, length);
	}

	static byte[] pdf(int length) {
		return startingWith("%PDF-1.7\n".getBytes(StandardCharsets.US_ASCII), length);
	}

	static RestTestClient.ResponseSpec reserve(RestTestClient client, String session, String purpose, String fileName,
			String mediaType, long sizeBytes) {
		return client.post()
			.uri("/api/storage/uploads")
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("purpose", purpose, "fileName", fileName, "mediaType", mediaType, "sizeBytes", sizeBytes))
			.exchange();
	}

	static Map<String, Object> ticket(RestTestClient client, String session, String purpose, String fileName,
			String mediaType, long sizeBytes) {
		Map<String, Object> ticket = reserve(client, session, purpose, fileName, mediaType, sizeBytes).expectStatus()
			.isCreated()
			.expectBody(JSON)
			.returnResult()
			.getResponseBody();
		if (ticket == null) {
			throw new AssertionError("A reserved upload answers with its ticket");
		}
		return ticket;
	}

	static RestTestClient.ResponseSpec confirm(RestTestClient client, String session, Object id) {
		return client.post()
			.uri("/api/storage/uploads/{id}/confirm", id)
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange();
	}

	private static byte[] startingWith(byte[] signature, int length) {
		byte[] content = Arrays.copyOf(signature, length);
		Arrays.fill(content, signature.length, length, (byte) 'x');
		return content;
	}
}
