package ai.genaifund.beyondpilot.solution.web;

import java.net.URI;
import java.nio.charset.StandardCharsets;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import ai.genaifund.beyondpilot.solution.dto.PublicSolutionListRequest;
import ai.genaifund.beyondpilot.solution.dto.PublicSolutionListResponse;
import ai.genaifund.beyondpilot.solution.dto.PublicSolutionResponse;
import ai.genaifund.beyondpilot.storage.FileDownload;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.jspecify.annotations.Nullable;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.InputStreamSource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The public directory of solutions, read without a session, and the deck of a solution. */
@RestController
@RequestMapping("/api/solution/solutions")
@Tag(name = "Solutions", description = "The public directory of approved AI solutions.")
class SolutionDirectoryController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final SolutionDirectory directory;

	SolutionDirectoryController(SolutionDirectory directory) {
		this.directory = directory;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listSolutions", summary = "The approved, listed solutions, in the order asked for")
	@ApiResponse(responseCode = "200", description = "One page of the solutions the parameters select.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PublicSolutionListResponse list(@Valid @ParameterObject PublicSolutionListRequest request) {
		return directory.list(request);
	}

	@GetMapping(path = "/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getSolution", summary = "One approved solution by its address, listed or not")
	@ApiResponse(responseCode = "200", description = "The solution.")
	@ApiResponse(responseCode = "404", description = "No approved solution has this address.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PublicSolutionResponse get(@PathVariable String slug) {
		return directory.get(slug);
	}

	@GetMapping("/{slug}/deck")
	@Operation(operationId = "getSolutionDeck", summary = "The deck of a solution",
			description = "The PDF, saved under its name, or a redirect to where the object store serves it. No "
					+ "session is needed for an approved solution; before that the members of its organization and "
					+ "the operators read it.")
	@ApiResponse(responseCode = "200", description = "The bytes of the deck.",
			content = @Content(mediaType = MediaType.APPLICATION_PDF_VALUE,
					schema = @Schema(type = "string", format = "binary")))
	@ApiResponse(responseCode = "302", description = "The address the object store serves the deck at, for a while.",
			content = @Content)
	@ApiResponse(responseCode = "404", description = "The solution has no deck, or the reader may not have it.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ResponseEntity<Resource> deck(@PathVariable String slug, @CurrentActor @Nullable Actor actor) {
		FileDownload download = directory.deck(slug, actor);
		URI redirect = download.redirect();
		if (redirect != null) {
			return ResponseEntity.status(HttpStatus.FOUND).location(redirect).build();
		}
		InputStreamSource content = download.content();
		if (content == null) {
			throw new IllegalStateException("A download carries a redirect or its content");
		}
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(download.mediaType()))
			.contentLength(download.sizeBytes())
			.header(HttpHeaders.CONTENT_DISPOSITION,
					ContentDisposition.attachment().filename(download.fileName(), StandardCharsets.UTF_8).build().toString())
			.body(new InputStreamResource(content));
	}
}
