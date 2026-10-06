package ai.genaifund.beyondpilot.introduction.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.introduction.IntroductionService;
import ai.genaifund.beyondpilot.introduction.dto.ReceivedIntroductionsResponse;
import ai.genaifund.beyondpilot.introduction.dto.RequestIntroductionRequest;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Asking for an introduction to the organization behind a solution, and answering such a request. */
@RestController
@RequestMapping("/api/introduction")
@Tag(name = "Introductions", description = "Requests for an introduction to the organization behind a solution.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = IntroductionsController.PROBLEM)))
class IntroductionsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final IntroductionService introductions;

	IntroductionsController(IntroductionService introductions) {
		this.introductions = introductions;
	}

	@PostMapping(path = "/introductions", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "requestIntroduction", summary = "Ask for an introduction to the organization behind a solution",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The request was recorded and the provider's owners were told.",
			content = @Content)
	@ApiResponse(responseCode = "400", description = "The solution or the message is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller belongs to no approved organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "No approved solution has the address.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The solution is the caller's own, or an earlier request about it still waits.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503", description = "Nobody at the provider can be asked right now.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void request(@CurrentActor Actor actor, @Valid @RequestBody RequestIntroductionRequest request) {
		introductions.request(actor, request);
	}

	@GetMapping(path = "/mine/received", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getReceivedIntroductions", summary = "The requests for an introduction to the caller's organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The requests, newest first.")
	@ApiResponse(responseCode = "403", description = "The caller belongs to no organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReceivedIntroductionsResponse received(@CurrentActor Actor actor) {
		return introductions.received(actor);
	}

	@PostMapping(path = "/mine/received/{id}/reply")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "replyToIntroduction", summary = "Accept a request: both sides learn each other's address",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The request was replied to and both sides were told.",
			content = @Content)
	@ApiResponse(responseCode = "403", description = "The caller is not an owner of the organization asked.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The organization asked has no such request.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The request was answered already.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void reply(@CurrentActor Actor actor, @PathVariable UUID id) {
		introductions.reply(actor, id);
	}

	@PostMapping(path = "/mine/received/{id}/decline")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "declineIntroduction", summary = "Decline a request; the sender learns no address",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The request was declined and the sender was told.",
			content = @Content)
	@ApiResponse(responseCode = "403", description = "The caller is not an owner of the organization asked.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The organization asked has no such request.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The request was answered already.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void decline(@CurrentActor Actor actor, @PathVariable UUID id) {
		introductions.decline(actor, id);
	}
}
