package ai.genaifund.beyondpilot.introduction.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.introduction.IntroductionAdministration;
import ai.genaifund.beyondpilot.introduction.dto.AdminIntroductionListRequest;
import ai.genaifund.beyondpilot.introduction.dto.AdminIntroductionListResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The operators' reading of the requests for an introduction. */
@RestController
@RequestMapping("/api/introduction/admin/introductions")
@Tag(name = "Introduction administration", description = "The requests for an introduction operators read.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminIntroductionsController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminIntroductionsController.PROBLEM)))
class AdminIntroductionsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final IntroductionAdministration introductions;

	AdminIntroductionsController(IntroductionAdministration introductions) {
		this.introductions = introductions;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAdminIntroductions",
			summary = "The requests for an introduction, those that wait first and the longest wait on top",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of the requests the parameters select.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminIntroductionListResponse list(@CurrentActor Actor actor,
			@Valid @ParameterObject AdminIntroductionListRequest request) {
		return introductions.list(actor, request);
	}
}
