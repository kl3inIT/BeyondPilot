package ai.genaifund.beyondpilot.storage.web;

import java.io.IOException;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.storage.StorageService;
import ai.genaifund.beyondpilot.storage.dto.ReserveUploadRequest;
import ai.genaifund.beyondpilot.storage.dto.StoredFileResponse;
import ai.genaifund.beyondpilot.storage.dto.UploadTicketResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/storage/uploads")
@Tag(name = "Storage", description = "Uploading and reading files.")
class UploadController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final StorageService storage;

	UploadController(StorageService storage) {
		this.storage = storage;
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "reserveUpload", summary = "Reserve an upload",
			description = "The first of three steps: reserve, send the bytes as the ticket says, confirm.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The pending file and where to send its bytes.")
	@ApiResponse(responseCode = "400", description = "The purpose refuses this media type or this size.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller may not upload for this purpose.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	UploadTicketResponse reserve(@CurrentActor Actor actor, @Valid @RequestBody ReserveUploadRequest request) {
		return storage.reserve(actor, request);
	}

	@PutMapping("/{id}/content")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "sendUploadContent", summary = "Send the bytes of an upload",
			description = "The address a ticket names when the object store receives uploads through this application. "
					+ "The body is the file; the token works once.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The bytes are written.")
	@ApiResponse(responseCode = "400", description = "The body is not the announced length.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The token is not valid or has been used.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller has no such pending upload.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "410", description = "The ticket has expired.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void receive(@CurrentActor Actor actor, @PathVariable UUID id, @RequestParam String token,
			HttpServletRequest request) throws IOException {
		storage.receive(actor, id, token, request.getContentLengthLong(), request.getInputStream());
	}

	@PostMapping(path = "/{id}/confirm", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "confirmUpload", summary = "Confirm an upload",
			description = "Checks that the bytes arrived and are the announced file. Only then can the file be used.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The stored file.")
	@ApiResponse(responseCode = "400", description = "The uploaded bytes are not the announced file.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller has no such upload.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Nothing has been uploaded yet.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	StoredFileResponse confirm(@CurrentActor Actor actor, @PathVariable UUID id) {
		return storage.confirm(actor, id);
	}
}
