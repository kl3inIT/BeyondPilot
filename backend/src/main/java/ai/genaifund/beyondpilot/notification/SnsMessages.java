package ai.genaifund.beyondpilot.notification;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Signature;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import org.jspecify.annotations.Nullable;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads a message of Amazon SNS once its signature checks, the way AWS documents it ("Verifying the signatures of
 * Amazon SNS messages"): the signing certificate comes over HTTPS from SNS's own host in the expected region, and the
 * signature covers the message's fields in a fixed order. AWS's sns-message-manager does the same but needs Apache
 * HttpClient 5 on the classpath, which every RestClient built outside Spring Boot would then pick up.
 */
class SnsMessages {

	/** The host of SNS in one region, the only place a signing certificate or a subscription address may be. */
	private static final String HOST = "sns.%s.amazonaws.com";

	private static final Pattern REGION = Pattern.compile("[a-z]{2}(-[a-z]+)+-\\d");

	private static final int MAX_CERTIFICATE_BYTES = 16 * 1024;

	/** The fields each type signs, in the order AWS signs them. */
	private static final Map<String, List<String>> SIGNED = Map.of("Notification",
			List.of("Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"), "SubscriptionConfirmation",
			List.of("Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"),
			"UnsubscribeConfirmation",
			List.of("Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"));

	private final JsonMapper json;

	private final HttpClient http;

	/** The certificates SNS signs with, by address; there are few, and they change rarely. */
	private final Map<URI, X509Certificate> certificates = new ConcurrentHashMap<>();

	SnsMessages(JsonMapper json, HttpClient http) {
		this.json = json;
		this.http = http;
	}

	/**
	 * A message whose signature checks.
	 * @param type {@code Notification}, {@code SubscriptionConfirmation} or {@code UnsubscribeConfirmation}
	 * @param subscribeUrl where to confirm a subscription; null for a notification
	 */
	record Message(String type, String messageId, String topicArn, String message, @Nullable URI subscribeUrl) {
	}

	/**
	 * Reads and checks one message.
	 * @param region the region the topic is in
	 * @throws IllegalArgumentException when the message is malformed, comes from elsewhere or does not verify
	 */
	Message read(String payload, String region) {
		if (!REGION.matcher(region).matches()) {
			throw new IllegalArgumentException("Not a region");
		}
		JsonNode message = json.readTree(payload);
		String type = field(message, "Type");
		List<String> signed = SIGNED.get(type);
		if (type == null || signed == null) {
			throw new IllegalArgumentException("Not an SNS message type");
		}
		String host = HOST.formatted(region);
		URI certificateUrl = snsAddress(field(message, "SigningCertURL"), host);
		if (!certificateUrl.getPath().endsWith(".pem")) {
			throw new IllegalArgumentException("Not a certificate address");
		}
		String algorithm = switch (String.valueOf(field(message, "SignatureVersion"))) {
			case "1" -> "SHA1withRSA";
			case "2" -> "SHA256withRSA";
			default -> throw new IllegalArgumentException("Not a known signature version");
		};
		StringBuilder canonical = new StringBuilder();
		for (String name : signed) {
			String value = field(message, name);
			if (value != null) {
				canonical.append(name).append('\n').append(value).append('\n');
			}
			else if (!"Subject".equals(name)) {
				throw new IllegalArgumentException("A signed field is missing");
			}
		}
		try {
			Signature check = Signature.getInstance(algorithm);
			check.initVerify(certificate(certificateUrl));
			check.update(canonical.toString().getBytes(StandardCharsets.UTF_8));
			if (!check.verify(Base64.getDecoder().decode(String.valueOf(field(message, "Signature"))))) {
				throw new IllegalArgumentException("The signature does not match");
			}
		}
		catch (GeneralSecurityException invalid) {
			throw new IllegalArgumentException("The signature could not be checked", invalid);
		}
		String subscribeUrl = field(message, "SubscribeURL");
		return new Message(type, required(message, "MessageId"), required(message, "TopicArn"),
				required(message, "Message"), subscribeUrl == null ? null : snsAddress(subscribeUrl, host));
	}

	/** The certificate at an address on SNS's host, fetched once; it must be valid now. */
	private X509Certificate certificate(URI address) throws GeneralSecurityException {
		X509Certificate certificate = certificates.get(address);
		if (certificate == null) {
			certificate = fetch(address);
			certificates.put(address, certificate);
		}
		certificate.checkValidity();
		return certificate;
	}

	private X509Certificate fetch(URI address) throws GeneralSecurityException {
		try {
			HttpResponse<byte[]> answer = http.send(HttpRequest.newBuilder(address)
				.timeout(Duration.ofSeconds(10))
				.GET()
				.build(), HttpResponse.BodyHandlers.ofByteArray());
			if (answer.statusCode() != 200 || answer.body().length > MAX_CERTIFICATE_BYTES) {
				throw new IllegalArgumentException("The signing certificate could not be read");
			}
			return (X509Certificate) CertificateFactory.getInstance("X.509")
				.generateCertificate(new ByteArrayInputStream(answer.body()));
		}
		catch (IOException unreachable) {
			throw new IllegalArgumentException("The signing certificate could not be read", unreachable);
		}
		catch (InterruptedException interrupted) {
			Thread.currentThread().interrupt();
			throw new IllegalArgumentException("Reading the signing certificate was interrupted", interrupted);
		}
	}

	/** An HTTPS address on SNS's host in the region, nowhere else. */
	private static URI snsAddress(@Nullable String value, String host) {
		if (value == null) {
			throw new IllegalArgumentException("An address is missing");
		}
		URI address = URI.create(value);
		if (!"https".equals(address.getScheme()) || !host.equals(address.getHost()) || address.getPort() != -1
				|| address.getUserInfo() != null) {
			throw new IllegalArgumentException("Not an address of SNS");
		}
		return address;
	}

	private static @Nullable String field(JsonNode message, String name) {
		JsonNode value = message.get(name);
		return value == null || !value.isString() ? null : value.asString();
	}

	private static String required(JsonNode message, String name) {
		String value = field(message, name);
		if (value == null) {
			throw new IllegalArgumentException("A field is missing");
		}
		return value;
	}

}
