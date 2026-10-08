package ai.genaifund.beyondpilot.identity.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.dto.ContactRequest;
import ai.genaifund.beyondpilot.identity.dto.MeResponse;
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

@RestController
@RequestMapping("/api/identity")
@Tag(name = "Identity", description = "Who is signed in.")
class MeController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final IdentityService identity;

	MeController(IdentityService identity) {
		this.identity = identity;
	}

	@GetMapping(path = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMe", summary = "The signed-in account",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The account of the session.")
	@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The account has been disabled.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = PROBLEM)))
	MeResponse me(@CurrentActor Actor actor) {
		return identity.me(actor);
	}

	@PutMapping(path = "/me/contact", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "updateMyContact", summary = "Change the account's country and phone number",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The account as it is now.")
	@ApiResponse(responseCode = "400", description = "The country or the number is not written as asked.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The account has been disabled.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = PROBLEM)))
	MeResponse reachAt(@CurrentActor Actor actor, @Valid @RequestBody ContactRequest request) {
		return identity.reachAt(actor, request);
	}
}
