package ai.genaifund.beyondpilot.talent.web;

import ai.genaifund.beyondpilot.talent.TalentDirectory;
import ai.genaifund.beyondpilot.talent.dto.PublicTalentListRequest;
import ai.genaifund.beyondpilot.talent.dto.PublicTalentListResponse;
import ai.genaifund.beyondpilot.talent.dto.PublicTalentResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The public directory of talent, read without a session. */
@RestController
@RequestMapping("/api/talent/profiles")
@Tag(name = "Talent", description = "The public directory of approved talent profiles.")
class TalentDirectoryController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private static final String NOT_FOUND = "No approved, listed profile has this address.";

	private final TalentDirectory directory;

	TalentDirectoryController(TalentDirectory directory) {
		this.directory = directory;
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
}
