package ai.genaifund.beyondpilot.storage;

import java.net.URI;
import java.time.Duration;

import org.jspecify.annotations.Nullable;
import org.springframework.core.io.InputStreamSource;

/**
 * How a file reaches its reader. An object store that can be read directly gives an address that works for a short
 * time; otherwise the bytes are read through this application. Exactly one of {@code redirect} and {@code content}
 * is set.
 * @param attachment whether the browser saves the file under its name instead of showing it
 * @param redirect the short-lived address to send the reader to
 * @param redirectLifetime how long that address works
 * @param content the bytes, opened when the response is written
 */
public record FileDownload(String fileName, String mediaType, long sizeBytes, boolean attachment,
		@Nullable URI redirect, @Nullable Duration redirectLifetime, @Nullable InputStreamSource content) {
}
