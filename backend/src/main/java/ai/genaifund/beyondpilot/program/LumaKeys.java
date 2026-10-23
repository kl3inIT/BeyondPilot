package ai.genaifund.beyondpilot.program;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import javax.crypto.spec.SecretKeySpec;

import ai.genaifund.beyondpilot.program.luma.LumaProperties;
import org.jspecify.annotations.Nullable;
import org.springframework.security.crypto.encrypt.AesGcmBytesEncryptor;
import org.springframework.security.crypto.encrypt.BytesEncryptor;
import org.springframework.stereotype.Component;

/**
 * Seals the Luma key and the webhook's secret with AES-256-GCM and a random IV per value, as {@code ai.AiKeys} seals
 * the AI providers' keys. The key is {@code BEYONDPILOT_PROGRAM_ENCRYPTION_KEY}; without it nothing is sealed or opened,
 * so a secret is never stored or read in clear.
 */
@Component
class LumaKeys {

	private final @Nullable BytesEncryptor encryptor;

	LumaKeys(LumaProperties properties) {
		String key = properties.encryptionKey();
		if (key == null || key.isBlank()) {
			this.encryptor = null;
			return;
		}
		byte[] bytes = Base64.getDecoder().decode(key.strip());
		if (bytes.length != 32) {
			throw new IllegalStateException("BEYONDPILOT_PROGRAM_ENCRYPTION_KEY must be 32 bytes in Base64");
		}
		this.encryptor = AesGcmBytesEncryptor.withSecretKey(new SecretKeySpec(bytes, "AES")).build();
	}

	/** Whether secrets can be kept and read. */
	boolean ready() {
		return encryptor != null;
	}

	/** @throws ProgramException when no encryption key is configured */
	byte[] seal(String secret) {
		if (encryptor == null) {
			throw new ProgramException(ProgramErrorCode.LUMA_ENCRYPTION_KEY_MISSING,
					"A Luma key was given but BEYONDPILOT_PROGRAM_ENCRYPTION_KEY is not set");
		}
		return encryptor.encrypt(secret.getBytes(StandardCharsets.UTF_8));
	}

	/** The secret in clear; null when none is stored or no encryption key is configured. */
	@Nullable String open(byte @Nullable [] sealed) {
		if (sealed == null || encryptor == null) {
			return null;
		}
		return new String(encryptor.decrypt(sealed), StandardCharsets.UTF_8);
	}

}
