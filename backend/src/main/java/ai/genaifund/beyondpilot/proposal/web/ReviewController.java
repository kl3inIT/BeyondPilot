package ai.genaifund.beyondpilot.proposal.web;

import static ai.genaifund.beyondpilot.proposal.web.ApplicationsController.PROBLEM;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.proposal.OutcomeService;
import ai.genaifund.beyondpilot.proposal.ReviewService;
import ai.genaifund.beyondpilot.proposal.dto.DecideRequest;
import ai.genaifund.beyondpilot.proposal.dto.ExportApplicationsRequest;
import ai.genaifund.beyondpilot.proposal.dto.ProgramDraftsResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReleaseDraftRequest;
import ai.genaifund.beyondpilot.proposal.dto.ReleaseEmails;
import ai.genaifund.beyondpilot.proposal.dto.ReleaseResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewApplicationResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewApplicationsResponse;
import ai.genaifund.beyondpilot.proposal.dto.SaveAssessmentRequest;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import ai.genaifund.beyondpilot.storage.FileDownload;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.InputStreamSource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
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

/** Scoring a program's applications, GenAI Fund's decisions and the release of the outcomes. */
@RestController
@RequestMapping("/api/proposal/review")
@Tag(name = "Review")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller does not review this program, or the action is an operator's.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
class ReviewController {

	private final ReviewService review;

	private final OutcomeService outcomes;

	ReviewController(ReviewService review, OutcomeService outcomes) {
		this.review = review;
		this.outcomes = outcomes;
	}

	@GetMapping(path = "/programs/{programId}/applications", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listReviewApplications", summary = "A program's submitted applications to review",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "The applications with the caller's scores; an operator also reads the decisions and every judge's average.")
	@ApiResponse(responseCode = "404", description = "There is no such program taking applications.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReviewApplicationsResponse applications(@CurrentActor Actor actor, @PathVariable UUID programId) {
		return review.applications(actor, programId);
	}

	@PostMapping(path = "/programs/{programId}/applications/export", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = { SpreadsheetFormat.XLSX_TYPE, SpreadsheetFormat.CSV_TYPE })
	@Operation(operationId = "exportReviewApplications",
			summary = "Download a program's submitted applications as a spreadsheet",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "One row for each application, with its applicant's contact details, decision and scores. The download is recorded.",
			content = { @Content(mediaType = SpreadsheetFormat.XLSX_TYPE, schema = @Schema(type = "string", format = "binary")),
					@Content(mediaType = SpreadsheetFormat.CSV_TYPE, schema = @Schema(type = "string", format = "binary")) })
	@ApiResponse(responseCode = "400", description = "The download would hold too many rows.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such program taking applications.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ResponseEntity<byte[]> export(@CurrentActor Actor actor, @PathVariable UUID programId,
			@Parameter(description = SpreadsheetFormat.DESCRIPTION,
					schema = @Schema(allowableValues = { "xlsx", "csv" }, defaultValue = "xlsx")) @RequestParam(
							defaultValue = "xlsx") @Pattern(regexp = SpreadsheetFormat.PATTERN) String format,
			@Valid @RequestBody ExportApplicationsRequest request) {
		return review.export(actor, programId, request, SpreadsheetFormat.of(format)).response();
	}

	@GetMapping(path = "/programs/{programId}/drafts", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listProgramDrafts",
			summary = "A program's applications not submitted yet, for operators to follow up",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "Each draft's applicant, how to reach them and how far they got, the most recently saved first. What a draft says is not read out.")
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such program taking applications.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ProgramDraftsResponse drafts(@CurrentActor Actor actor, @PathVariable UUID programId) {
		return review.drafts(actor, programId);
	}

	@PostMapping(path = "/programs/{programId}/drafts/export",
			produces = { SpreadsheetFormat.XLSX_TYPE, SpreadsheetFormat.CSV_TYPE })
	@Operation(operationId = "exportProgramDrafts",
			summary = "Download a program's applications not submitted yet as a spreadsheet",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "One row for each draft, with its applicant's contact details and how far they got. The download is recorded.",
			content = { @Content(mediaType = SpreadsheetFormat.XLSX_TYPE, schema = @Schema(type = "string", format = "binary")),
					@Content(mediaType = SpreadsheetFormat.CSV_TYPE, schema = @Schema(type = "string", format = "binary")) })
	@ApiResponse(responseCode = "400", description = "The download would hold too many rows.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such program taking applications.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ResponseEntity<byte[]> exportDrafts(@CurrentActor Actor actor, @PathVariable UUID programId,
			@Parameter(description = SpreadsheetFormat.DESCRIPTION,
					schema = @Schema(allowableValues = { "xlsx", "csv" }, defaultValue = "xlsx")) @RequestParam(
							defaultValue = "xlsx") @Pattern(regexp = SpreadsheetFormat.PATTERN) String format) {
		return review.exportDrafts(actor, programId, SpreadsheetFormat.of(format)).response();
	}

	@GetMapping(path = "/applications/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getReviewApplication", summary = "One application as it was submitted last",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "The application with the caller's assessment; an operator also reads every score and the decisions.")
	@ApiResponse(responseCode = "404", description = "There is no such submitted application.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReviewApplicationResponse application(@CurrentActor Actor actor, @PathVariable UUID id) {
		return review.application(actor, id);
	}

	@PutMapping(path = "/applications/{id}/assessment", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveAssessment", summary = "Keep the caller's assessment of an application",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The application with the assessment as saved.")
	@ApiResponse(responseCode = "400", description = "A criterion is not scored from 1 to 5.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such submitted application.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The program has no criteria, or its outcomes were released.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReviewApplicationResponse assess(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SaveAssessmentRequest request) {
		return review.assess(actor, id, request);
	}

	@GetMapping("/applications/{id}/files/{fileId}")
	@Operation(operationId = "getReviewFile", summary = "A file of an application's last submission",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The bytes of the file, saved under its name.",
			content = @Content(mediaType = MediaType.ALL_VALUE, schema = @Schema(type = "string", format = "binary")))
	@ApiResponse(responseCode = "302", description = "The address the object store serves the file at, for a while.",
			content = @Content)
	@ApiResponse(responseCode = "404", description = "The submission holds no such file.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ResponseEntity<Resource> file(@CurrentActor Actor actor, @PathVariable UUID id, @PathVariable UUID fileId) {
		FileDownload download = review.file(actor, id, fileId);
		URI redirect = download.redirect();
		if (redirect != null) {
			return ResponseEntity.status(HttpStatus.FOUND).location(redirect).cacheControl(CacheControl.noStore()).build();
		}
		InputStreamSource content = download.content();
		if (content == null) {
			throw new IllegalStateException("A download carries a redirect or its content");
		}
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(download.mediaType()))
			.contentLength(download.sizeBytes())
			.cacheControl(CacheControl.noStore())
			.header(HttpHeaders.CONTENT_DISPOSITION,
					ContentDisposition.attachment().filename(download.fileName(), StandardCharsets.UTF_8).build().toString())
			.body(new InputStreamResource(content));
	}

	@PostMapping(path = "/programs/{programId}/decisions", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "decideApplications", summary = "Shortlist applications, or mark them not selected",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The program's applications with the decisions recorded.")
	@ApiResponse(responseCode = "400", description = "The decision is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "An application is not one of the program's submitted ones.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The outcomes were released.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReviewApplicationsResponse decide(@CurrentActor Actor actor, @PathVariable UUID programId,
			@Valid @RequestBody DecideRequest request) {
		return outcomes.decide(actor, programId, request);
	}

	@GetMapping(path = "/programs/{programId}/release", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getRelease", summary = "What releasing a program's outcomes would send, and whether it can",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The groups, their emails and whether the release is ready.")
	@ApiResponse(responseCode = "404", description = "There is no such program taking applications.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReleaseResponse release(@CurrentActor Actor actor, @PathVariable UUID programId) {
		return outcomes.release(actor, programId);
	}

	@PutMapping(path = "/programs/{programId}/release/draft", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "keepReleaseDraft",
			summary = "Keep the emails of a release as they are being written; nothing is sent",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The emails as kept.")
	@ApiResponse(responseCode = "400", description = "A subject or a message is longer than it may be.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such program taking applications.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The outcomes were released.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReleaseEmails keepReleaseDraft(@CurrentActor Actor actor, @PathVariable UUID programId,
			@Valid @RequestBody ReleaseDraftRequest draft) {
		return outcomes.keepDraft(actor, programId, draft);
	}

	@PostMapping(path = "/programs/{programId}/release", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "releaseOutcomes", summary = "Release a program's outcomes to every applicant",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The release as made. Each applicant gets their group's email.")
	@ApiResponse(responseCode = "400", description = "An email is missing its subject or message.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such program taking applications.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "Applications have not closed, an application has no decision, or the outcomes were released.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReleaseResponse releaseOutcomes(@CurrentActor Actor actor, @PathVariable UUID programId,
			@Valid @RequestBody ReleaseEmails emails) {
		return outcomes.release(actor, programId, emails);
	}
}
