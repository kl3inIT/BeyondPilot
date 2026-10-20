package ai.genaifund.beyondpilot.identity.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.AuditLogDownload;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.identity.dto.AuditLogExportRequest;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The audit log as operators download it; reading it page by page stays with {@code audit}. */
@RestController
@RequestMapping("/api/identity/admin/audit-events")
@Tag(name = "Audit", description = "The record of sensitive changes, read by operators.")
class AuditLogDownloadController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final AuditLogDownload download;

	AuditLogDownloadController(AuditLogDownload download) {
		this.download = download;
	}

	@PostMapping(path = "/export", produces = { SpreadsheetFormat.XLSX_TYPE, SpreadsheetFormat.CSV_TYPE })
	@Operation(operationId = "exportAuditEvents", summary = "Download the audit log as a spreadsheet",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "Every event the parameters select, newest first, one row each. The download is recorded.",
			content = { @Content(mediaType = SpreadsheetFormat.XLSX_TYPE, schema = @Schema(type = "string", format = "binary")),
					@Content(mediaType = SpreadsheetFormat.CSV_TYPE, schema = @Schema(type = "string", format = "binary")) })
	@ApiResponse(responseCode = "400", description = "A parameter is not valid, or the download would hold too many rows.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ResponseEntity<byte[]> export(@CurrentActor Actor actor, @Valid @ParameterObject AuditLogExportRequest request) {
		SpreadsheetFormat format = SpreadsheetFormat.of(request.format() == null ? "xlsx" : request.format());
		return download.export(actor, request.from(), request.action(), request.q(), request.actions(), format).response();
	}

}
