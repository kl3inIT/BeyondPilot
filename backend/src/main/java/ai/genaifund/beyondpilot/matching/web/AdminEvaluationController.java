package ai.genaifund.beyondpilot.matching.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.matching.EvaluationBoard;
import ai.genaifund.beyondpilot.matching.dto.EvaluationBoardResponse;
import ai.genaifund.beyondpilot.matching.dto.EvaluationCandidateResponse;
import ai.genaifund.beyondpilot.matching.dto.StartEvaluationRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** A program's evaluation board, for operators (BEY-234). */
@RestController
@RequestMapping("/api/matching/admin/programs/{programId}/evaluations")
@Tag(name = "Evaluation",
		description = "Every submission to a program grouped as candidates, with the shortlist tier the AI suggests and the evidence behind it. Decisions stay on the applications and the proposals.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminMatchingController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminMatchingController.PROBLEM)))
class AdminEvaluationController {

	private final EvaluationBoard board;

	AdminEvaluationController(EvaluationBoard board) {
		this.board = board;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getEvaluationBoard",
			summary = "A program's candidates with the tier the AI suggests and the evidence behind it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The board as it stands.")
	EvaluationBoardResponse board(@CurrentActor Actor actor, @PathVariable UUID programId) {
		return board.board(actor, programId);
	}

	@GetMapping(path = "/{organizationId}/{solutionId}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getEvaluationCandidate",
			summary = "One candidate with its current assessment and the earlier ones",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The candidate.")
	@ApiResponse(responseCode = "404", description = "The program has no such candidate now.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = AdminMatchingController.PROBLEM)))
	EvaluationCandidateResponse candidate(@CurrentActor Actor actor, @PathVariable UUID programId,
			@PathVariable UUID organizationId, @PathVariable UUID solutionId) {
		return board.candidate(actor, programId, organizationId, solutionId);
	}

	@PostMapping(path = "/runs", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "startEvaluation", summary = "Start an evaluation run of the program now",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The run is queued; the board as it stands.")
	@ApiResponse(responseCode = "409",
			description = "The program has no approved use case, or a run of it is at work.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = AdminMatchingController.PROBLEM)))
	@ApiResponse(responseCode = "503", description = "No AI model is set for evaluation.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = AdminMatchingController.PROBLEM)))
	EvaluationBoardResponse start(@CurrentActor Actor actor, @PathVariable UUID programId,
			@Valid @RequestBody StartEvaluationRequest request) {
		return board.start(actor, programId, request);
	}

}
