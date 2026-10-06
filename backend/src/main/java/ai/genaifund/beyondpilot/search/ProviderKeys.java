package ai.genaifund.beyondpilot.search;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;

import javax.crypto.spec.SecretKeySpec;

import org.jspecify.annotations.Nullable;
import org.springframework.security.crypto.encrypt.AesGcmBytesEncryptor;
import org.springframework.security.crypto.encrypt.BytesEncryptor;
import org.springframework.stereotype.Component;

/**
 * Seals the AI providers' keys with AES-256-GCM and a random IV per value (Spring Security Crypto's
 * {@code AesGcmBytesEncryptor}). The key is {@code BEYONDPILOT_AI_ENCRYPTION_KEY}; without it nothing is sealed or
 * opened, so a provider key is never stored or read in clear.
 */
@Component
class ProviderKeys {

	private final @Nullable BytesEncryptor encryptor;

	ProviderKeys(EmbeddingSettings settings) {
		String key = settings.encryptionKey();
		if (key == null || key.isBlank()) {
			this.encryptor = null;
			return;
		}
		byte[] bytes = Base64.getDecoder().decode(key.strip());
		if (bytes.length != 32) {
			throw new IllegalStateException("BEYONDPILOT_AI_ENCRYPTION_KEY must be 32 bytes in Base64");
		}
		this.encryptor = AesGcmBytesEncryptor.withSecretKey(new SecretKeySpec(bytes, "AES")).build();
	}

	/** Whether keys can be stored and read. */
	boolean open() {
		return encryptor != null;
	}

	/** @throws SearchException when no encryption key is configured */
	byte[] seal(String key) {
		if (encryptor == null) {
			throw new SearchException(SearchErrorCode.ENCRYPTION_KEY_MISSING,
					"A provider key was given but BEYONDPILOT_AI_ENCRYPTION_KEY is not set");
		}
		return encryptor.encrypt(key.getBytes(StandardCharsets.UTF_8));
	}

	/** The key in clear; empty when none is stored or no encryption key is configured. */
	Optional<String> open(byte @Nullable [] sealed) {
		if (sealed == null || encryptor == null) {
			return Optional.empty();
		}
		return Optional.of(new String(encryptor.decrypt(sealed), StandardCharsets.UTF_8));
	}

}
