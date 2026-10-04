package ai.genaifund.beyondpilot.storage.web;

import java.net.URI;
import java.time.Duration;
import java.util.UUID;

import ai.genaifund.beyondpilot.storage.FileDownload;
import ai.genaifund.beyondpilot.storage.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.InputStreamSource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/storage/files")
@Tag(name = "Storage")
class FileController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	/** A file never changes, so a copy is good for as long as a cache keeps it. */
	private static final CacheControl FOREVER = CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable();

	private final StorageService storage;

	FileController(StorageService storage) {
		this.storage = storage;
	}

	@GetMapping("/{id}")
	@Operation(operationId = "getPublicFile", summary = "A public file",
			description = "The bytes of a file anyone may read, such as an image of a program, or a redirect to "
					+ "where the object store serves them. No session is needed.")
	@ApiResponse(responseCode = "200", description = "The bytes of the file.",
			content = @Content(mediaType = MediaType.ALL_VALUE, schema = @Schema(type = "string", format = "binary")))
	@ApiResponse(responseCode = "302", description = "The address the object store serves the file at, for a while.",
			content = @Content)
	@ApiResponse(responseCode = "404", description = "No stored public file has this identifier.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ResponseEntity<Resource> file(@PathVariable UUID id) {
		FileDownload download = storage.publicFile(id);
		URI redirect = download.redirect();
		Duration redirectLifetime = download.redirectLifetime();
		if (redirect != null && redirectLifetime != null) {
			// The browser may reuse the redirect, but not for longer than the address behind it works.
			return ResponseEntity.status(HttpStatus.FOUND)
				.location(redirect)
				.cacheControl(CacheControl.maxAge(redirectLifetime.dividedBy(2)).cachePrivate())
				.build();
		}
		InputStreamSource content = download.content();
		if (content == null) {
			throw new IllegalStateException("A download carries a redirect or its content");
		}
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(download.mediaType()))
			.contentLength(download.sizeBytes())
			.cacheControl(FOREVER)
			.body(new InputStreamResource(content));
	}
}
