package ai.genaifund.beyondpilot.solution.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.solution.SolutionAdministration;
import ai.genaifund.beyondpilot.solution.SolutionService;
import ai.genaifund.beyondpilot.solution.dto.CustomerDeploymentResponse;
import ai.genaifund.beyondpilot.solution.dto.RejectCustomerDeploymentRequest;
import ai.genaifund.beyondpilot.solution.dto.SaveCustomerDeploymentRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The customer deployments an organization tells about its solutions, and the operators' review of them. */
@RestController
@RequestMapping("/api/solution")
@Tag(name = "Customer deployments", description = "The projects in which a customer put a solution to work.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = CustomerDeploymentsController.PROBLEM)))
class CustomerDeploymentsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private static final String NOT_WRITER = "The caller is not an owner of an approved organization.";

	private static final String NOT_FOUND = "There is no such customer deployment for this caller.";

	private static final String NOT_OPERATOR = "The caller is not an operator.";

	private final SolutionService solutions;

	private final SolutionAdministration administration;

	CustomerDeploymentsController(SolutionService solutions, SolutionAdministration administration) {
		this.solutions = solutions;
		this.administration = administration;
	}

	@PostMapping(path = "/mine/{solutionId}/deployments", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "addCustomerDeployment", summary = "Add a customer deployment to a solution",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The deployment, waiting for review.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = NOT_WRITER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller's organization has no such solution.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The solution already lists as many as it may.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	CustomerDeploymentResponse add(@CurrentActor Actor actor, @PathVariable UUID solutionId,
			@Valid @RequestBody SaveCustomerDeploymentRequest request) {
		return solutions.addDeployment(actor, solutionId, request);
	}

	@PutMapping(path = "/mine/{solutionId}/deployments/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveCustomerDeployment",
			summary = "Save a customer deployment, which sends it to review again",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The deployment as saved, waiting for review.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = NOT_WRITER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The deployment changed since it was read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	CustomerDeploymentResponse save(@CurrentActor Actor actor, @PathVariable UUID solutionId, @PathVariable UUID id,
			@Valid @RequestBody SaveCustomerDeploymentRequest request) {
		return solutions.saveDeployment(actor, solutionId, id, request);
	}

	@DeleteMapping("/mine/{solutionId}/deployments/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "deleteCustomerDeployment", summary = "Remove a customer deployment",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The deployment is gone.", content = @Content)
	@ApiResponse(responseCode = "403", description = NOT_WRITER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void delete(@CurrentActor Actor actor, @PathVariable UUID solutionId, @PathVariable UUID id) {
		solutions.deleteDeployment(actor, solutionId, id);
	}

	@PostMapping("/admin/deployments/{id}/approve")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "approveCustomerDeployment",
			summary = "Approve a customer deployment that waits for review",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The deployment is approved.", content = @Content)
	@ApiResponse(responseCode = "403", description = NOT_OPERATOR,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The deployment is not waiting for review.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void approve(@CurrentActor Actor actor, @PathVariable UUID id) {
		administration.approveDeployment(actor, id);
	}

	@PostMapping(path = "/admin/deployments/{id}/reject", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "rejectCustomerDeployment",
			summary = "Reject a customer deployment that waits for review, or take an approved one off its solution",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The deployment is rejected, with the reason.", content = @Content)
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = NOT_OPERATOR,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The deployment is neither waiting for review nor approved.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void reject(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody RejectCustomerDeploymentRequest request) {
		administration.rejectDeployment(actor, id, request);
	}

}
