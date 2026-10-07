package ai.genaifund.beyondpilot.usecase.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.usecase.UseCaseAdministration;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseListRequest;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseListResponse;
import ai.genaifund.beyondpilot.usecase.dto.AdminUseCaseResponse;
import ai.genaifund.beyondpilot.usecase.dto.CreateUseCaseRequest;
import ai.genaifund.beyondpilot.usecase.dto.SendBackUseCaseRequest;
import ai.genaifund.beyondpilot.usecase.dto.SetUseCaseProgramsRequest;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseOrganizationListRequest;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseOrganizationListResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
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

/** The operators' work on use cases: every use case in any status, and writing one for an organization. */
@RestController
@RequestMapping("/api/usecase/admin")
@Tag(name = "Use case administration", description = "The use cases operators write and read.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminUseCasesController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminUseCasesController.PROBLEM)))
class AdminUseCasesController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final UseCaseAdministration useCases;

	AdminUseCasesController(UseCaseAdministration useCases) {
		this.useCases = useCases;
	}

	@GetMapping(path = "/use-cases", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAdminUseCases", summary = "The use cases, the newest first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of the use cases the parameters select.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminUseCaseListResponse list(@CurrentActor Actor actor, @Valid @ParameterObject AdminUseCaseListRequest request) {
		return useCases.list(actor, request);
	}

	@PostMapping(path = "/use-cases", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "createAdminUseCase",
			summary = "Create a use case for an organization, as a draft or published",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The use case, a draft or published as asked.")
	@ApiResponse(responseCode = "400", description = """
			A member is not valid, the organization is not approved, the close date is not in the \
			future, or the budget or the timeline is out of order.""",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminUseCaseResponse create(@CurrentActor Actor actor, @Valid @RequestBody CreateUseCaseRequest request) {
		return useCases.create(actor, request);
	}

	@GetMapping(path = "/use-cases/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getAdminUseCase", summary = "One use case as an operator reads it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The use case.")
	@ApiResponse(responseCode = "404", description = "There is no such use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminUseCaseResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return useCases.get(actor, id);
	}

	@PostMapping(path = "/use-cases/{id}/approve", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "approveAdminUseCase", summary = "Approve a use case in review and publish it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The use case, now published.")
	@ApiResponse(responseCode = "404", description = "There is no such use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The use case is not in review.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminUseCaseResponse approve(@CurrentActor Actor actor, @PathVariable UUID id) {
		return useCases.approve(actor, id);
	}

	@PostMapping(path = "/use-cases/{id}/send-back", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "sendBackAdminUseCase", summary = "Send a use case in review back with what to change",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The use case, now needing changes.")
	@ApiResponse(responseCode = "400", description = "The reason is missing or too long.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The use case is not in review.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminUseCaseResponse sendBack(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SendBackUseCaseRequest request) {
		return useCases.sendBack(actor, id, request);
	}

	@PutMapping(path = "/use-cases/{id}/programs", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "setAdminUseCasePrograms", summary = "Set the programs a use case belongs to",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The use case with its programs.")
	@ApiResponse(responseCode = "400", description = "A program does not exist, or there are more than ten.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminUseCaseResponse setPrograms(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SetUseCaseProgramsRequest request) {
		return useCases.setPrograms(actor, id, request);
	}

	@GetMapping(path = "/organizations", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listUseCaseOrganizations",
			summary = "The organizations a use case can be written for",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The approved organizations, by name.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	UseCaseOrganizationListResponse organizations(@CurrentActor Actor actor,
			@Valid @ParameterObject UseCaseOrganizationListRequest request) {
		return useCases.organizations(actor, request);
	}
}
