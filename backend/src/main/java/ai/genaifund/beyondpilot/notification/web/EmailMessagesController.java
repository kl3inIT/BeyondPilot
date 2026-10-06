package ai.genaifund.beyondpilot.notification.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.notification.EmailActivity;
import ai.genaifund.beyondpilot.notification.dto.EmailMessageListRequest;
import ai.genaifund.beyondpilot.notification.dto.EmailMessageListResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailMessageResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailResentResponse;
import jakarta.validation.Valid;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The email log: what was sent, to whom, and what became of it. */
@RestController
@RequestMapping("/api/notification/admin/email/messages")
@Tag(name = "Email administration", description = "Who delivers BeyondPilot's email, its wording, what was sent and the addresses it is not sent to.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = EmailMessagesController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = EmailMessagesController.PROBLEM)))
class EmailMessagesController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final EmailActivity activity;

	EmailMessagesController(EmailActivity activity) {
		this.activity = activity;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listEmailMessages", summary = "The email log, newest first, a page at a time", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page, its cursors and the counts of the period.")
	@ApiResponse(responseCode = "400", description = "A filter or a cursor is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailMessageListResponse list(@CurrentActor Actor actor, @Valid @ParameterObject EmailMessageListRequest request) {
		return activity.list(actor, request);
	}

	@GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getEmailMessage", summary = "One email as it was sent, with what happened to it", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The email.")
	@ApiResponse(responseCode = "404", description = "There is no such email.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailMessageResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return activity.get(actor, id);
	}

	@PostMapping(path = "/{id}/resend", produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "resendEmailMessage", summary = "Send an email again, as it was sent, to the same address", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The new email, queued.")
	@ApiResponse(responseCode = "404", description = "There is no such email.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "It is a sign-in code, or its address is suppressed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailResentResponse resend(@CurrentActor Actor actor, @PathVariable UUID id) {
		return activity.resend(actor, id);
	}

}
