package ai.genaifund.beyondpilot.matching.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.matching.MatchingAdministration;
import ai.genaifund.beyondpilot.matching.dto.MatchingFeedbackListRequest;
import ai.genaifund.beyondpilot.matching.dto.MatchingFeedbackListResponse;
import ai.genaifund.beyondpilot.matching.dto.MatchingSettingsResponse;
import ai.genaifund.beyondpilot.matching.dto.SaveMatchingSettingsRequest;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The limits of matching and what people said about its groups, for operators. */
@RestController
@RequestMapping("/api/matching/admin")
@Tag(name = "Matching administration",
		description = "The limits of matching that operators set, and what people said about the groups the AI gave.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminMatchingController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminMatchingController.PROBLEM)))
class AdminMatchingController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final MatchingAdministration administration;

	AdminMatchingController(MatchingAdministration administration) {
		this.administration = administration;
	}

	@GetMapping(path = "/settings", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMatchingSettings", summary = "The limits of matching",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The limits as they are set.")
	MatchingSettingsResponse settings(@CurrentActor Actor actor) {
		return administration.settings(actor);
	}

	@PutMapping(path = "/settings", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveMatchingSettings", summary = "Set the limits of matching",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The limits were kept.")
	@ApiResponse(responseCode = "400", description = "A limit is outside what is allowed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Someone else changed the limits meanwhile.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MatchingSettingsResponse save(@CurrentActor Actor actor, @Valid @RequestBody SaveMatchingSettingsRequest request) {
		return administration.save(actor, request);
	}

	@GetMapping(path = "/feedback", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listMatchingFeedback",
			summary = "How often people agreed with the group the AI gave a solution, and the answers that say a group is wrong",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "The answers of the last 30 days counted, and one page of the disagreements, newest first.")
	@ApiResponse(responseCode = "400", description = "The page is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MatchingFeedbackListResponse feedback(@CurrentActor Actor actor,
			@Valid @ParameterObject MatchingFeedbackListRequest request) {
		return administration.feedback(actor, request);
	}

}
