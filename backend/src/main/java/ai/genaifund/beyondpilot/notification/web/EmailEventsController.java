package ai.genaifund.beyondpilot.notification.web;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import ai.genaifund.beyondpilot.notification.EmailEventIntake;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Where providers report what became of sent email. These addresses take no session and no CSRF header: the provider
 * calls them, and each report's signature is checked before anything in it is read.
 */
@RestController
@RequestMapping("/api/notification/email/events")
@Tag(name = "Email delivery events",
		description = "Reports of delivery, bounces and complaints, sent by the email provider and checked by signature.")
@ApiResponse(responseCode = "403", description = "The report's signature does not check, or it is not from the configured provider.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = EmailEventsController.PROBLEM)))
class EmailEventsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final EmailEventIntake intake;

	EmailEventsController(EmailEventIntake intake) {
		this.intake = intake;
	}

	@PostMapping(path = "/resend", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "receiveResendEvent", summary = "A webhook of Resend, signed with the webhook secret")
	@ApiResponse(responseCode = "204", description = "The report was taken, or it concerns no email of BeyondPilot.",
			content = @Content)
	void resend(@Parameter(hidden = true) @RequestHeader HttpHeaders headers, @RequestBody String payload) {
		Map<String, String> named = new HashMap<>();
		headers.forEach((name, values) -> named.put(name.toLowerCase(Locale.ROOT), values.getFirst()));
		intake.resend(named, payload);
	}

	@PostMapping(path = "/ses", consumes = { MediaType.TEXT_PLAIN_VALUE, MediaType.APPLICATION_JSON_VALUE })
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "receiveSesEvent",
			summary = "A message of Amazon SNS with an event of SES, or a request to confirm the subscription")
	@ApiResponse(responseCode = "204", description = "The message was taken.", content = @Content)
	@ApiResponse(responseCode = "503", description = "The subscription could not be confirmed now; SNS asks again.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void ses(@RequestBody String payload) {
		intake.ses(payload);
	}

}
