package ai.genaifund.beyondpilot.storage;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.jspecify.annotations.Nullable;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.InputStreamSource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

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

	/**
	 * The answer to a request for a private file: a redirect to the object store, or the bytes, inline or saved under
	 * the name as {@code attachment} says, and never kept by a cache.
	 */
	public ResponseEntity<Resource> response() {
		if (redirect != null) {
			return ResponseEntity.status(HttpStatus.FOUND).location(redirect).cacheControl(CacheControl.noStore()).build();
		}
		if (content == null) {
			throw new IllegalStateException("A download carries a redirect or its content");
		}
		ContentDisposition disposition = (attachment ? ContentDisposition.attachment() : ContentDisposition.inline())
			.filename(fileName, StandardCharsets.UTF_8)
			.build();
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(mediaType))
			.contentLength(sizeBytes)
			.cacheControl(CacheControl.noStore())
			.header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
			.body(new InputStreamResource(content));
	}
}
