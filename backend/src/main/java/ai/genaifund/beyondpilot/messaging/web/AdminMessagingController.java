package ai.genaifund.beyondpilot.messaging.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.messaging.MessagingAdministration;
import ai.genaifund.beyondpilot.messaging.dto.ReportedRequestListRequest;
import ai.genaifund.beyondpilot.messaging.dto.ReportedRequestListResponse;
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

/** The first messages people reported as unwanted, for operators to read. */
@RestController
@RequestMapping("/api/messaging/admin/reported")
@Tag(name = "Messaging administration", description = "The first messages reported as unwanted.")
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

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listReportedConversations",
			summary = "The first messages reported as unwanted, the most recently reported first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of the reported first messages.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = MessagingController.PROBLEM)))
	ReportedRequestListResponse list(@CurrentActor Actor actor,
			@Valid @ParameterObject ReportedRequestListRequest request) {
		return messaging.reported(actor, request);
	}

}
