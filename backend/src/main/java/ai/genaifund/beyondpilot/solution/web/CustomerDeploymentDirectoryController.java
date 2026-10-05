package ai.genaifund.beyondpilot.solution.web;

import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import ai.genaifund.beyondpilot.solution.dto.PublicCustomerDeploymentListRequest;
import ai.genaifund.beyondpilot.solution.dto.PublicCustomerDeploymentListResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The approved customer deployments of an organization, read without a session. */
@RestController
@RequestMapping("/api/solution/deployments")
@Tag(name = "Solutions", description = "The public directory of approved AI solutions.")
class CustomerDeploymentDirectoryController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final SolutionDirectory directory;

	CustomerDeploymentDirectoryController(SolutionDirectory directory) {
		this.directory = directory;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listCustomerDeployments",
			summary = "The approved customer deployments of an organization, the most recently approved first")
	@ApiResponse(responseCode = "200", description = "One page of the deployments.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PublicCustomerDeploymentListResponse list(@Valid @ParameterObject PublicCustomerDeploymentListRequest request) {
		return directory.deployments(request);
	}

}
