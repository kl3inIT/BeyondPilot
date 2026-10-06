package ai.genaifund.beyondpilot.notification.settings;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;

import javax.crypto.spec.SecretKeySpec;

import ai.genaifund.beyondpilot.notification.NotificationProperties;
import org.jspecify.annotations.Nullable;
import org.springframework.security.crypto.encrypt.AesGcmBytesEncryptor;
import org.springframework.security.crypto.encrypt.BytesEncryptor;
import org.springframework.stereotype.Component;

/**
 * Encrypts the providers' secrets one field at a time with AES-256-GCM and a random IV per value (Spring Security
 * Crypto's {@code AesGcmBytesEncryptor}). The key is {@code BEYONDPILOT_NOTIFICATION_ENCRYPTION_KEY}; without it the
 * box is closed and refuses both ways, so a secret is never stored or read in clear.
 */
@Component
public class SecretBox {

	private final @Nullable BytesEncryptor encryptor;

	SecretBox(NotificationProperties properties) {
		String key = properties.encryptionKey();
		if (key == null || key.isBlank()) {
			this.encryptor = null;
			return;
		}
		byte[] bytes = Base64.getDecoder().decode(key.strip());
		if (bytes.length != 32) {
			throw new IllegalStateException("BEYONDPILOT_NOTIFICATION_ENCRYPTION_KEY must be 32 bytes in Base64");
		}
		this.encryptor = AesGcmBytesEncryptor.withSecretKey(new SecretKeySpec(bytes, "AES")).build();
	}

	/** Whether secrets can be stored and read. */
	public boolean open() {
		return encryptor != null;
	}

	/** @throws IllegalStateException when the box is closed */
	public byte[] seal(String secret) {
		return encryptor().encrypt(secret.getBytes(StandardCharsets.UTF_8));
	}

	/** The secret in clear; empty when none is stored or the box is closed. */
	public Optional<String> open(byte @Nullable [] sealed) {
		if (sealed == null || encryptor == null) {
			return Optional.empty();
		}
		return Optional.of(new String(encryptor.decrypt(sealed), StandardCharsets.UTF_8));
	}

	private BytesEncryptor encryptor() {
		if (encryptor == null) {
			throw new IllegalStateException("No encryption key is configured for email secrets");
		}
		return encryptor;
	}

}
