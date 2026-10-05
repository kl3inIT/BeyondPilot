package ai.genaifund.beyondpilot.talent.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.talent.TalentService;
import ai.genaifund.beyondpilot.talent.dto.MyTalentResponse;
import ai.genaifund.beyondpilot.talent.dto.SaveTalentProfileRequest;
import ai.genaifund.beyondpilot.talent.dto.TalentProfileResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The caller's own talent profile. */
@RestController
@RequestMapping("/api/talent/mine")
@Tag(name = "My talent profile", description = "The caller's own talent profile.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = MyTalentController.PROBLEM)))
class MyTalentController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final TalentService talent;

	MyTalentController(TalentService talent) {
		this.talent = talent;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMyTalentProfile", summary = "The caller's talent profile and the messages sent through it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The profile, or none yet, and the messages.")
	MyTalentResponse get(@CurrentActor Actor actor) {
		return talent.mine(actor);
	}

	@PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveMyTalentProfile", summary = "Save the caller's talent profile; the first save creates it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The profile as saved, with its new version.")
	@ApiResponse(responseCode = "400",
			description = "A member is not valid, or a submitted or approved profile would lose what a submission needs.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The profile changed since it was read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	TalentProfileResponse save(@CurrentActor Actor actor, @Valid @RequestBody SaveTalentProfileRequest request) {
		return talent.save(actor, request);
	}

	@PostMapping(path = "/submit", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "submitMyTalentProfile", summary = "Send the caller's talent profile to GenAI Fund for review",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The profile, waiting for review.")
	@ApiResponse(responseCode = "400", description = "The profile lacks what a submission needs.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller has no profile.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The profile is already submitted or approved.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	TalentProfileResponse submit(@CurrentActor Actor actor) {
		return talent.submit(actor);
	}
}
