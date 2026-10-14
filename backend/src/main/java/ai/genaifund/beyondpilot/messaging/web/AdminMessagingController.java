package ai.genaifund.beyondpilot.messaging.web;

import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.messaging.MessagingAdministration;
import ai.genaifund.beyondpilot.messaging.dto.ProgramConversationAssignmentResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;

/** Program chat assignment without message content. */
@RestController
@RequestMapping("/api/messaging/admin")
@Tag(name = "Messaging administration", description = "Program chat assignment without message content.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = MessagingController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = MessagingController.PROBLEM)))
class AdminMessagingController {

	private final MessagingAdministration messaging;

	AdminMessagingController(MessagingAdministration messaging) {
		this.messaging = messaging;
	}

	@GetMapping(path = "/program-assignments", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listProgramConversationAssignments",
			summary = "Program conversation assignments without message content or sender details",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "Up to 100 program conversations, unassigned first.")
	List<ProgramConversationAssignmentResponse> programAssignments(@CurrentActor Actor actor) {
		return messaging.programAssignments(actor);
	}

	@PutMapping(path = "/program-assignments/{id}/{accountId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "assignProgramConversation",
			summary = "Assign a program conversation to one active operator",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "Only the assigned operator may read and answer the conversation.")
	@ApiResponse(responseCode = "404", description = "The program conversation or active operator is absent.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = MessagingController.PROBLEM)))
	void assignProgram(@CurrentActor Actor actor, @PathVariable UUID id, @PathVariable UUID accountId) {
		messaging.assignProgram(actor, id, accountId);
	}

}
