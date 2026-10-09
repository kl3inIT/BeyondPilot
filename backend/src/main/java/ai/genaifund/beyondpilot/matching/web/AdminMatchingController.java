package ai.genaifund.beyondpilot.matching.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.matching.MatchingAdministration;
import ai.genaifund.beyondpilot.matching.dto.MatchingSettingsResponse;
import ai.genaifund.beyondpilot.matching.dto.SaveMatchingSettingsRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The limits of matching, for operators. */
@RestController
@RequestMapping("/api/matching/admin")
@Tag(name = "Matching administration", description = "The limits of matching that operators set.")
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

}
