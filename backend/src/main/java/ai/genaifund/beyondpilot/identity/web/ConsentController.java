package ai.genaifund.beyondpilot.identity.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.Consents;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.identity.dto.ConsentRequest;
import ai.genaifund.beyondpilot.identity.dto.ConsentResponse;
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
@RequestMapping("/api/identity/consent")
@Tag(name = "Identity", description = "Who is signed in.")
class ConsentController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final Consents consents;

	ConsentController(Consents consents) {
		this.consents = consents;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMyConsent", summary = "The consent text and what the caller agreed to",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The current text and the caller's choices.")
	@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The account has been disabled.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = PROBLEM)))
	ConsentResponse current(@CurrentActor Actor actor) {
		return consents.current(actor);
	}

	@PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "recordMyConsent", summary = "Record the caller's choice for every purpose",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The choices as they are now.")
	@ApiResponse(responseCode = "400", description = "A purpose or the source is missing or not one of those listed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The account has been disabled.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = PROBLEM)))
	ConsentResponse record(@CurrentActor Actor actor, @Valid @RequestBody ConsentRequest request) {
		return consents.record(actor, request);
	}
}
