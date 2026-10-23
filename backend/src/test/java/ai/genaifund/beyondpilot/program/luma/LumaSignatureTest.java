package ai.genaifund.beyondpilot.program.luma;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.HexFormat;

import org.junit.jupiter.api.Test;

/** A delivery is Luma's only when it signs the body with the webhook's secret at a moment close to now (BEY-245). */
class LumaSignatureTest {

	private static final String SECRET = "whsec_abc";

	private static final byte[] BODY = "{\"type\":\"event.updated\"}".getBytes(UTF_8);

	private static final Instant NOW = Instant.parse("2026-10-23T06:00:00Z");

	@Test
	void aSignatureOfTheBodyWithTheSecretChecksAmongOthers() {
		long at = NOW.getEpochSecond();
		String signed = signature(SECRET, at, BODY);

		assertThat(LumaSignature.valid(SECRET, "t=" + at + ",v1=" + signed, BODY, NOW)).isTrue();
		// Luma may send more than one v1, as when it rotates a secret.
		assertThat(LumaSignature.valid(SECRET, "t=" + at + ",v1=" + signature("old", at, BODY) + ",v1=" + signed, BODY,
				NOW)).isTrue();
	}

	@Test
	void anotherSecretAnotherBodyAnOldMomentOrABrokenHeaderDoNotCheck() {
		long at = NOW.getEpochSecond();

		assertThat(LumaSignature.valid(SECRET, "t=" + at + ",v1=" + signature("other", at, BODY), BODY, NOW)).isFalse();
		assertThat(LumaSignature.valid(SECRET, "t=" + at + ",v1=" + signature(SECRET, at, BODY), "{}".getBytes(UTF_8),
				NOW)).isFalse();
		long old = NOW.minus(LumaSignature.TOLERANCE).minusSeconds(1).getEpochSecond();
		assertThat(LumaSignature.valid(SECRET, "t=" + old + ",v1=" + signature(SECRET, old, BODY), BODY, NOW)).isFalse();
		// A retry seven minutes later keeps its first moment and still checks.
		long retried = NOW.minusSeconds(7 * 60).getEpochSecond();
		assertThat(LumaSignature.valid(SECRET, "t=" + retried + ",v1=" + signature(SECRET, retried, BODY), BODY, NOW))
			.isTrue();
		assertThat(LumaSignature.valid(SECRET, null, BODY, NOW)).isFalse();
		assertThat(LumaSignature.valid(SECRET, "v1=" + signature(SECRET, at, BODY), BODY, NOW)).isFalse();
		assertThat(LumaSignature.valid(SECRET, "t=soon,v1=zz", BODY, NOW)).isFalse();
	}

	private static String signature(String secret, long at, byte[] body) {
		return HexFormat.of().formatHex(LumaSignature.sign(secret, at, body));
	}

}
