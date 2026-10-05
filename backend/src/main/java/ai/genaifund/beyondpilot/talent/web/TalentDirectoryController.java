package ai.genaifund.beyondpilot.talent.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.talent.TalentDirectory;
import ai.genaifund.beyondpilot.talent.TalentService;
import ai.genaifund.beyondpilot.talent.dto.PublicTalentListRequest;
import ai.genaifund.beyondpilot.talent.dto.PublicTalentListResponse;
import ai.genaifund.beyondpilot.talent.dto.PublicTalentResponse;
import ai.genaifund.beyondpilot.talent.dto.SendTalentEnquiryRequest;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The public directory of talent, read without a session, and the message a signed-in person sends through it. */
@RestController
@RequestMapping("/api/talent/profiles")
@Tag(name = "Talent", description = "The public directory of approved talent profiles.")
class TalentDirectoryController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private static final String NOT_FOUND = "No approved, listed profile has this address.";

	private final TalentDirectory directory;

	private final TalentService talent;

	TalentDirectoryController(TalentDirectory directory, TalentService talent) {
		this.directory = directory;
		this.talent = talent;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listTalent", summary = "The approved, listed talent profiles, in the order asked for")
	@ApiResponse(responseCode = "200", description = "One page of the profiles the parameters select.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PublicTalentListResponse list(@Valid @ParameterObject PublicTalentListRequest request) {
		return directory.list(request);
	}

	@GetMapping(path = "/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getTalent", summary = "One talent profile of the directory by its address")
	@ApiResponse(responseCode = "200", description = "The profile.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PublicTalentResponse get(@PathVariable String slug) {
		return directory.get(slug);
	}

	@PostMapping(path = "/{slug}/enquiries", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "sendTalentEnquiry", summary = "Send a message to the person behind a talent profile",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The message was sent to the person by email.", content = @Content)
	@ApiResponse(responseCode = "400", description = "The message is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The profile is the caller's own.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "429", description = "The caller already wrote through this profile within a day.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void enquire(@CurrentActor Actor actor, @PathVariable String slug,
			@Valid @RequestBody SendTalentEnquiryRequest request) {
		talent.enquire(actor, slug, request);
	}
}
