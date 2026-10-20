package ai.genaifund.beyondpilot.matching.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.matching.MatchingAdministration;
import ai.genaifund.beyondpilot.matching.dto.MatchingFeedbackListRequest;
import ai.genaifund.beyondpilot.matching.dto.MatchingFeedbackListResponse;
import ai.genaifund.beyondpilot.matching.dto.MatchingRunListRequest;
import ai.genaifund.beyondpilot.matching.dto.MatchingRunListResponse;
import ai.genaifund.beyondpilot.matching.dto.MatchingRunResponse;
import ai.genaifund.beyondpilot.matching.dto.MatchingSettingsResponse;
import ai.genaifund.beyondpilot.matching.dto.SaveMatchingSettingsRequest;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The limits of matching, what people said about its groups, and its runs, for operators. */
@RestController
@RequestMapping("/api/matching/admin")
@Tag(name = "Matching administration",
		description = "The limits of matching that operators set, what people said about the groups the AI gave, and the runs with what they cost.")
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

	@PostMapping(path = "/feedback/export", produces = { SpreadsheetFormat.XLSX_TYPE, SpreadsheetFormat.CSV_TYPE })
	@Operation(operationId = "exportMatchingFeedback",
			summary = "Download the answers that say a group is wrong as a spreadsheet",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "Every disagreement, newest first, whenever it was given, one row each. The download is recorded.",
			content = { @Content(mediaType = SpreadsheetFormat.XLSX_TYPE, schema = @Schema(type = "string", format = "binary")),
					@Content(mediaType = SpreadsheetFormat.CSV_TYPE, schema = @Schema(type = "string", format = "binary")) })
	@ApiResponse(responseCode = "400", description = "The format is not valid, or the download would hold too many rows.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ResponseEntity<byte[]> exportFeedback(@CurrentActor Actor actor,
			@Parameter(description = SpreadsheetFormat.DESCRIPTION,
					schema = @Schema(allowableValues = { "xlsx", "csv" }, defaultValue = "xlsx")) @RequestParam(
							defaultValue = "xlsx") @Pattern(regexp = SpreadsheetFormat.PATTERN) String format) {
		return administration.exportFeedback(actor, SpreadsheetFormat.of(format)).response();
	}

	@GetMapping(path = "/runs", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listMatchingRuns",
			summary = "The runs of every use case, each with what its calls to the AI came to",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of the runs, the newest first.")
	@ApiResponse(responseCode = "400", description = "The page is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MatchingRunListResponse runs(@CurrentActor Actor actor, @Valid @ParameterObject MatchingRunListRequest request) {
		return administration.runs(actor, request);
	}

	@GetMapping(path = "/runs/{runId}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMatchingRun",
			summary = "One run: what it cost, its steps, and which solutions changed group since the run before it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The run in detail.")
	@ApiResponse(responseCode = "404", description = "There is no such run.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MatchingRunResponse run(@CurrentActor Actor actor, @PathVariable UUID runId) {
		return administration.run(actor, runId);
	}

}
