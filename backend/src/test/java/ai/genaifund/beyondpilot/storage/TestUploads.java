package ai.genaifund.beyondpilot.storage;

import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.TestSignIn;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Uploads over HTTP for the tests of the modules whose records name stored files: the three requests of the storage
 * module, then the identifier of the stored file.
 */
public final class TestUploads {

	private TestUploads() {
	}

	/** Stores a small PNG for the purpose, as the account of the session. */
	public static UUID image(RestTestClient client, String session, String purpose, String fileName) {
		return file(client, session, purpose, fileName, "image/png", StorageTestSupport.png(300));
	}

	/** Stores the content under the name and the media type, as the account of the session. */
	public static UUID file(RestTestClient client, String session, String purpose, String fileName, String mediaType,
			byte[] content) {
		Map<String, Object> ticket = StorageTestSupport.ticket(client, session, purpose, fileName, mediaType,
				content.length);
		client.put()
			.uri((String) ticket.get("url"))
			.header(TestSignIn.CSRF_HEADER, "1")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_OCTET_STREAM)
			.body(content)
			.exchange()
			.expectStatus()
			.isNoContent();
		StorageTestSupport.confirm(client, session, ticket.get("id")).expectStatus().isOk();
		return UUID.fromString((String) ticket.get("id"));
	}
}
