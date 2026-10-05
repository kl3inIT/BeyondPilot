package ai.genaifund.beyondpilot.audit.web;

import ai.genaifund.beyondpilot.audit.AuditLog;
import ai.genaifund.beyondpilot.audit.dto.AuditEventListRequest;
import ai.genaifund.beyondpilot.audit.dto.AuditEventListResponse;
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

/** The operators' reading of the audit log. The filter chain lets only operators reach this path. */
@RestController
@RequestMapping("/api/audit/events")
@Tag(name = "Audit", description = "The record of sensitive changes, read by operators.")
class AuditEventsController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final AuditLog log;

	AuditEventsController(AuditLog log) {
		this.log = log;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAuditEvents", summary = "The audit events, newest first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of the events the parameters select.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AuditEventListResponse list(@Valid @ParameterObject AuditEventListRequest request) {
		return log.list(request);
	}

}
