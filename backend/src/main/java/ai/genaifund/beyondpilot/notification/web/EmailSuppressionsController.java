package ai.genaifund.beyondpilot.notification.web;

import ai.genaifund.beyondpilot.notification.EmailSuppressions;
import ai.genaifund.beyondpilot.notification.dto.AddEmailSuppressionRequest;
import ai.genaifund.beyondpilot.notification.dto.EmailSuppressionListRequest;
import ai.genaifund.beyondpilot.notification.dto.EmailSuppressionListResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailSuppressionResponse;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The addresses BeyondPilot does not send to. */
@RestController
@RequestMapping("/api/notification/admin/suppressions")
@Tag(name = "Email administration", description = "Who delivers BeyondPilot's email, its wording, what was sent and the addresses it is not sent to.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = EmailSuppressionsController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = EmailSuppressionsController.PROBLEM)))
class EmailSuppressionsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final EmailSuppressions suppressions;

	EmailSuppressionsController(EmailSuppressions suppressions) {
		this.suppressions = suppressions;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listEmailSuppressions", summary = "The suppressed addresses, newest first", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of addresses.")
	@ApiResponse(responseCode = "400", description = "A filter or the page is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailSuppressionListResponse list(@CurrentActor Actor actor,
			@Valid @ParameterObject EmailSuppressionListRequest request) {
		return suppressions.list(actor, request);
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "addEmailSuppression", summary = "Stop sending to an address", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The address, suppressed.")
	@ApiResponse(responseCode = "400", description = "The address is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The address is already suppressed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailSuppressionResponse add(@CurrentActor Actor actor, @Valid @RequestBody AddEmailSuppressionRequest request) {
		return suppressions.add(actor, request);
	}

	@DeleteMapping(path = "/{address}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "removeEmailSuppression", summary = "Let email reach an address again", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "Email reaches the address again.", content = @Content)
	@ApiResponse(responseCode = "404", description = "The address is not suppressed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void remove(@CurrentActor Actor actor, @PathVariable String address) {
		suppressions.remove(actor, address);
	}

}
