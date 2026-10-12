package ai.genaifund.beyondpilot.proposal.web;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.proposal.UseCaseProposals;
import ai.genaifund.beyondpilot.proposal.dto.ApplicantOrganizationRequest;
import ai.genaifund.beyondpilot.proposal.dto.ReceivedUseCaseProposalResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReceivedUseCaseProposalsResponse;
import ai.genaifund.beyondpilot.proposal.dto.SaveUseCaseProposalRequest;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalCountsRequest;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalCountsResponse;
import ai.genaifund.beyondpilot.proposal.dto.UseCaseProposalFormResponse;
import ai.genaifund.beyondpilot.storage.FileDownload;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
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
import org.springframework.web.bind.annotation.RestController;

/** The proposals organizations send to use cases, and the reading of those a use case received. */
@RestController
@RequestMapping("/api/proposal")
@Tag(name = "Use case proposals", description = "What an organization sends to a use case, and what a use case received.")
class UseCaseProposalsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final UseCaseProposals proposals;

	UseCaseProposalsController(UseCaseProposals proposals) {
		this.proposals = proposals;
	}

	@GetMapping(path = "/use-cases/{useCaseId}/proposal", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getUseCaseProposalForm", summary = "The proposal form of a use case for the caller",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "The use case, the caller's organization with its solutions and members, and the proposal if one was saved.")
	@ApiResponse(responseCode = "403", description = "The caller's organization posted the use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The use case no longer takes proposals.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	UseCaseProposalFormResponse form(@CurrentActor Actor actor, @PathVariable UUID useCaseId) {
		return proposals.form(actor, useCaseId);
	}

	@PostMapping(path = "/use-cases/{useCaseId}/organization", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "organizeUseCaseProposal",
			summary = "Make the organization a person sends a proposal for when they belong to none",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The form, now with the new organization.")
	@ApiResponse(responseCode = "404", description = "There is no such use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The use case no longer takes proposals, or the caller already belongs to an organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	UseCaseProposalFormResponse organize(@CurrentActor Actor actor, @PathVariable UUID useCaseId,
			@Valid @RequestBody ApplicantOrganizationRequest request) {
		return proposals.organize(actor, useCaseId, request);
	}

	@PutMapping(path = "/use-cases/{useCaseId}/proposal", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveUseCaseProposal", summary = "Keep what the proposal form holds",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The form with the proposal as saved.")
	@ApiResponse(responseCode = "400",
			description = "The team names someone who is not a member, a member twice or two primary contacts, or the solution is not the organization's.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403",
			description = "The caller has no organization, or it posted the use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The use case no longer takes proposals, the proposal was sent, or it changed since the form read it.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	UseCaseProposalFormResponse save(@CurrentActor Actor actor, @PathVariable UUID useCaseId,
			@Valid @RequestBody SaveUseCaseProposalRequest request) {
		return proposals.save(actor, useCaseId, request);
	}

	@PostMapping(path = "/use-case-proposals/{id}/send", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "sendUseCaseProposal", summary = "Send a proposal to its use case",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The form with the proposal as sent.")
	@ApiResponse(responseCode = "400", description = "The proposal lacks what sending needs; its code says what.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller's organization is not approved.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller's organization has no such proposal.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The proposal was sent, or the use case no longer takes proposals.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	UseCaseProposalFormResponse send(@CurrentActor Actor actor, @PathVariable UUID id) {
		return proposals.send(actor, id);
	}

	@GetMapping(path = "/use-cases/{useCaseId}/proposals", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listUseCaseProposals", summary = "The proposals a use case received",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The sent proposals, the latest first.")
	@ApiResponse(responseCode = "404",
			description = "There is no such use case, or the caller is neither of the organization that posted it nor an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReceivedUseCaseProposalsResponse received(@CurrentActor Actor actor, @PathVariable UUID useCaseId) {
		return proposals.received(actor, useCaseId);
	}

	@GetMapping(path = "/use-case-proposals/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getReceivedUseCaseProposal", summary = "One proposal a use case received",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The proposal as sent, with the sender's profile and the team.")
	@ApiResponse(responseCode = "404",
			description = "The proposal was not sent, or the caller is neither of the organization that posted its use case nor an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReceivedUseCaseProposalResponse receivedOne(@CurrentActor Actor actor, @PathVariable UUID id) {
		return proposals.receivedOne(actor, id);
	}

	@GetMapping("/use-case-proposals/{id}/file")
	@Operation(operationId = "getUseCaseProposalFile", summary = "The PDF of a proposal a use case received",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The bytes of the PDF, saved under its name.",
			content = @Content(mediaType = MediaType.ALL_VALUE, schema = @Schema(type = "string", format = "binary")))
	@ApiResponse(responseCode = "302", description = "The address the object store serves the file at, for a while.",
			content = @Content)
	@ApiResponse(responseCode = "404",
			description = "The proposal was not sent, or the caller is neither of the organization that posted its use case nor an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ResponseEntity<Resource> file(@CurrentActor Actor actor, @PathVariable UUID id) {
		FileDownload download = proposals.file(actor, id);
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

	@GetMapping(path = "/use-case-proposal-counts", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "countUseCaseProposals", summary = "How many proposals use cases received",
			description = "Read without a session: anyone sees how many proposals a use case has.", security = {})
	@ApiResponse(responseCode = "200", description = "The number of sent proposals of each use case asked about.")
	@ApiResponse(responseCode = "400", description = "No use case, or more than 50.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	UseCaseProposalCountsResponse counts(@Valid @ParameterObject UseCaseProposalCountsRequest request) {
		return proposals.counts(request.useCaseIds());
	}
}
