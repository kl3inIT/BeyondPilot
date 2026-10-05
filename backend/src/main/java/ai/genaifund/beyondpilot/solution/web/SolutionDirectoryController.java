package ai.genaifund.beyondpilot.solution.web;

import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import ai.genaifund.beyondpilot.solution.dto.PublicSolutionListRequest;
import ai.genaifund.beyondpilot.solution.dto.PublicSolutionListResponse;
import ai.genaifund.beyondpilot.solution.dto.PublicSolutionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The public directory of solutions, read without a session. */
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
	@Operation(operationId = "getSolution", summary = "One solution of the directory by its address")
	@ApiResponse(responseCode = "200", description = "The solution.")
	@ApiResponse(responseCode = "404", description = "No approved, listed solution has this address.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PublicSolutionResponse get(@PathVariable String slug) {
		return directory.get(slug);
	}
}
