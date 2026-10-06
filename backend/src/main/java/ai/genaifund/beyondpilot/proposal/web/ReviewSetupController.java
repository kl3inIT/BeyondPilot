package ai.genaifund.beyondpilot.proposal.web;

import static ai.genaifund.beyondpilot.proposal.web.ApplicationsController.PROBLEM;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.proposal.ReviewSetup;
import ai.genaifund.beyondpilot.proposal.dto.CriteriaResponse;
import ai.genaifund.beyondpilot.proposal.dto.InviteReviewerRequest;
import ai.genaifund.beyondpilot.proposal.dto.ReviewProgramsResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewersResponse;
import ai.genaifund.beyondpilot.proposal.dto.SaveCriteriaRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** How a program's review is set up: its judging criteria and the judges GenAI Fund invites. */
@RestController
@RequestMapping("/api/proposal/review")
@Tag(name = "Review", description = "Scoring a program's applications, deciding on them and releasing the outcomes.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
class ReviewSetupController {

	private final ReviewSetup setup;

	ReviewSetupController(ReviewSetup setup) {
		this.setup = setup;
	}

	@GetMapping(path = "/programs", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listReviewPrograms", summary = "The programs whose applications the caller scores",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "For an operator, every program with a submitted application; for a judge, the programs they were invited to.")
	ReviewProgramsResponse programs(@CurrentActor Actor actor) {
		return setup.programs(actor);
	}

	@GetMapping(path = "/programs/{programId}/criteria", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getReviewCriteria", summary = "What a program's applications are judged on",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The criteria in order, and whether they are fixed.")
	@ApiResponse(responseCode = "403", description = "The caller does not review this program.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such program taking applications.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	CriteriaResponse criteria(@CurrentActor Actor actor, @PathVariable UUID programId) {
		return setup.criteria(actor, programId);
	}

	@PutMapping(path = "/programs/{programId}/criteria", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveReviewCriteria", summary = "Replace a program's judging criteria",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The criteria as saved.")
	@ApiResponse(responseCode = "400", description = "A criterion is not valid, or two share a name.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such program taking applications.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "An application has been scored on the criteria.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	CriteriaResponse saveCriteria(@CurrentActor Actor actor, @PathVariable UUID programId,
			@Valid @RequestBody SaveCriteriaRequest request) {
		return setup.saveCriteria(actor, programId, request);
	}

	@GetMapping(path = "/programs/{programId}/reviewers", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listReviewers", summary = "Who scores a program's applications, with their progress",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The judges and the operators who scored, with how many each scored.")
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such program taking applications.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReviewersResponse reviewers(@CurrentActor Actor actor, @PathVariable UUID programId) {
		return setup.reviewers(actor, programId);
	}

	@PostMapping(path = "/programs/{programId}/reviewers", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "inviteReviewer", summary = "Invite an address to judge a program",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The judges, the new one invited. The invitation goes by email.")
	@ApiResponse(responseCode = "400", description = "The address is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such program taking applications.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The address is already invited to this program.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReviewersResponse invite(@CurrentActor Actor actor, @PathVariable UUID programId,
			@Valid @RequestBody InviteReviewerRequest request) {
		return setup.invite(actor, programId, request);
	}

	@PostMapping(path = "/programs/{programId}/reviewers/{reviewerId}/resend",
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "resendReviewerInvitation", summary = "Send an unused invitation again",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The judges; the invitation is open for another seven days.")
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The program has no such judge.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The judge has already signed in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReviewersResponse resend(@CurrentActor Actor actor, @PathVariable UUID programId, @PathVariable UUID reviewerId) {
		return setup.resend(actor, programId, reviewerId);
	}

	@DeleteMapping(path = "/programs/{programId}/reviewers/{reviewerId}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "removeReviewer", summary = "Take a judge off a program",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The judges that remain. The scores the judge gave stay.")
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The program has no such judge.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReviewersResponse remove(@CurrentActor Actor actor, @PathVariable UUID programId, @PathVariable UUID reviewerId) {
		return setup.remove(actor, programId, reviewerId);
	}
}
