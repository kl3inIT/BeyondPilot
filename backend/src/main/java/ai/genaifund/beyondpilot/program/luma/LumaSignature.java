package ai.genaifund.beyondpilot.program.luma;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.jspecify.annotations.Nullable;

/**
 * Checks that a webhook delivery comes from Luma (BEY-245). Luma signs {@code "<t>." + body} with HMAC-SHA256 and the
 * webhook's whole secret, and sends {@code Webhook-Signature: t=<unix seconds>,v1=<hex>}; there may be more than one
 * {@code v1}. A retry keeps its first {@code t}, and Luma retries for seven minutes, so the window is wider than that.
 */
public final class LumaSignature {

	/** How old a signed moment may be, or how far ahead. */
	public static final Duration TOLERANCE = Duration.ofMinutes(15);

	private LumaSignature() {
	}

	/** Whether the header signs the body with the secret at a moment close enough to now. */
	public static boolean valid(String secret, @Nullable String header, byte[] body, Instant now) {
		if (header == null) {
			return false;
		}
		Long signedAt = null;
		List<byte[]> signatures = new ArrayList<>();
		for (String part : header.split(",")) {
			String[] pair = part.strip().split("=", 2);
			if (pair.length != 2) {
				continue;
			}
			try {
				switch (pair[0]) {
					case "t" -> signedAt = Long.parseLong(pair[1]);
					case "v1" -> signatures.add(HexFormat.of().parseHex(pair[1]));
					default -> {
						// Another scheme Luma may add; only v1 is known.
					}
				}
			}
			catch (IllegalArgumentException malformed) {
				return false;
			}
		}
		if (signedAt == null || signatures.isEmpty()
				|| Duration.between(Instant.ofEpochSecond(signedAt), now).abs().compareTo(TOLERANCE) > 0) {
			return false;
		}
		byte[] expected = sign(secret, signedAt, body);
		return signatures.stream().anyMatch(signature -> MessageDigest.isEqual(expected, signature));
	}

	/** The signature Luma would send; also what a test signs a delivery with. */
	public static byte[] sign(String secret, long signedAt, byte[] body) {
		try {
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
			mac.update((signedAt + ".").getBytes(StandardCharsets.UTF_8));
			return mac.doFinal(body);
		}
		catch (NoSuchAlgorithmException | InvalidKeyException unavailable) {
			throw new IllegalStateException("HMAC-SHA256 is not available", unavailable);
		}
	}

}
