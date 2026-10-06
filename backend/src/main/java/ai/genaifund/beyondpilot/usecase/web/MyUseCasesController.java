package ai.genaifund.beyondpilot.usecase.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.usecase.UseCaseService;
import ai.genaifund.beyondpilot.usecase.dto.MyUseCaseResponse;
import ai.genaifund.beyondpilot.usecase.dto.MyUseCasesResponse;
import ai.genaifund.beyondpilot.usecase.dto.SaveMyUseCaseRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The members' work on the use cases of their own organization. */
@RestController
@RequestMapping("/api/usecase/mine")
@Tag(name = "My organization's use cases", description = "The use cases the members of an organization write.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = MyUseCasesController.PROBLEM)))
@ApiResponse(responseCode = "403",
		description = "The caller is not a member of an approved organization that publishes use cases.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = MyUseCasesController.PROBLEM)))
class MyUseCasesController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final UseCaseService useCases;

	MyUseCasesController(UseCaseService useCases) {
		this.useCases = useCases;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listMyUseCases", summary = "The use cases of the caller's organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "Every use case of the organization, the most recently touched first.")
	MyUseCasesResponse list(@CurrentActor Actor actor) {
		return useCases.mine(actor);
	}

	@PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "createMyUseCase", summary = "Start an empty draft for the caller's organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The empty draft.")
	MyUseCaseResponse create(@CurrentActor Actor actor) {
		return useCases.create(actor);
	}

	@GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMyUseCase", summary = "One use case of the caller's organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The use case.")
	@ApiResponse(responseCode = "404", description = "The organization has no such use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MyUseCaseResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return useCases.get(actor, id);
	}

	@PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveMyUseCase", summary = "Save what the members have written so far",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The use case as saved, with its new version.")
	@ApiResponse(responseCode = "400", description = "A part is not valid, or the budget or the timeline is out of order.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The organization has no such use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The use case is in review or closed, or someone saved a newer version.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MyUseCaseResponse save(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SaveMyUseCaseRequest request) {
		return useCases.save(actor, id, request);
	}

	@PostMapping(path = "/{id}/submit", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "submitMyUseCase", summary = "Send a draft to GenAI Fund for review",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The use case, now in review.")
	@ApiResponse(responseCode = "400", description = "A part is missing, or the close date has passed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The organization has no such use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The use case is not a draft.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MyUseCaseResponse submit(@CurrentActor Actor actor, @PathVariable UUID id) {
		return useCases.submit(actor, id);
	}

	@PostMapping(path = "/{id}/draft", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "moveMyUseCaseToDraft",
			summary = "Take a use case out of review, or out of the directory, back to a draft",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The use case, now a draft.")
	@ApiResponse(responseCode = "404", description = "The organization has no such use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The use case is neither in review nor published.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MyUseCaseResponse draft(@CurrentActor Actor actor, @PathVariable UUID id) {
		return useCases.backToDraft(actor, id);
	}
}
