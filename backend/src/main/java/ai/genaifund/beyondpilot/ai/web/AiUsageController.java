package ai.genaifund.beyondpilot.ai.web;

import ai.genaifund.beyondpilot.ai.AiUsageReports;
import ai.genaifund.beyondpilot.ai.dto.AiUsageCallListRequest;
import ai.genaifund.beyondpilot.ai.dto.AiUsageCallListResponse;
import ai.genaifund.beyondpilot.ai.dto.AiUsageOverviewRequest;
import ai.genaifund.beyondpilot.ai.dto.AiUsageOverviewResponse;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
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

/** Admin › AI › Usage: what the calls to models and OCR services came to, and the log of them. */
@RestController
@RequestMapping("/api/ai/admin/usage")
@Tag(name = "AI administration")
class AiUsageController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final AiUsageReports reports;

	AiUsageController(AiUsageReports reports) {
		this.reports = reports;
	}

	@GetMapping(path = "/overview", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getAiUsageOverview",
			summary = "What the calls to models and OCR services came to in a period, and what is failing",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The totals, what is failing, the calls over time and where they went.")
	@ApiResponse(responseCode = "400", description = "The period or the grouping is not one of those offered.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AiUsageOverviewResponse overview(@CurrentActor Actor actor, @Valid @ParameterObject AiUsageOverviewRequest request) {
		return reports.overview(actor, request);
	}

	@GetMapping(path = "/calls", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAiUsageCalls", summary = "The calls made to models and OCR services",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of calls, newest first.")
	@ApiResponse(responseCode = "400", description = "The period, the outcome or the page is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AiUsageCallListResponse calls(@CurrentActor Actor actor, @Valid @ParameterObject AiUsageCallListRequest request) {
		return reports.calls(actor, request);
	}

}
