package ai.genaifund.beyondpilot.usecase.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.usecase.UseCaseDirectory;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseListRequest;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseListResponse;
import ai.genaifund.beyondpilot.usecase.dto.PublicUseCaseResponse;
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

/** The public list of use cases, read without a session. */
@RestController
@RequestMapping("/api/usecase/use-cases")
@Tag(name = "Use cases", description = "The public list of published use cases.")
class UseCaseDirectoryController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final UseCaseDirectory directory;

	UseCaseDirectoryController(UseCaseDirectory directory) {
		this.directory = directory;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listUseCases", summary = "The published use cases that still accept proposals")
	@ApiResponse(responseCode = "200", description = "One page of the use cases the parameters select.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PublicUseCaseListResponse list(@Valid @ParameterObject PublicUseCaseListRequest request) {
		return directory.list(request);
	}

	@GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getUseCase", summary = "One published use case that still accepts proposals")
	@ApiResponse(responseCode = "200", description = "The use case.")
	@ApiResponse(responseCode = "404", description = "No published use case has this identifier, or it has closed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PublicUseCaseResponse get(@PathVariable UUID id) {
		return directory.get(id);
	}
}
