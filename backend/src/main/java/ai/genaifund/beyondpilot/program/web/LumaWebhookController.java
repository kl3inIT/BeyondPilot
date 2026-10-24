package ai.genaifund.beyondpilot.program.web;

import ai.genaifund.beyondpilot.program.LumaAdministration;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.jspecify.annotations.Nullable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * Where Luma tells BeyondPilot that an event of the connected calendar changed (BEY-245). It takes no session and no
 * CSRF header: Luma calls it, and the delivery's signature is checked before anything is done. A delivery that is not
 * Luma's is answered 403, never 410, which would pause the webhook.
 */
@RestController
@Tag(name = "Luma webhook", description = "Deliveries of the connected Luma calendar's webhook, checked by signature.")
class LumaWebhookController {

	private final LumaAdministration luma;

	LumaWebhookController(LumaAdministration luma) {
		this.luma = luma;
	}

	@PostMapping(path = LumaAdministration.WEBHOOK_PATH, consumes = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "receiveLumaWebhook",
			summary = "A webhook of Luma, signed with the secret Luma gave when BeyondPilot made it",
			description = "A signed delivery about an event makes BeyondPilot read the calendar again soon, and one about a "
					+ "guest reads that event's guests; of the payload only the event's identifier is used.")
	@ApiResponse(responseCode = "204", description = "The delivery was taken.", content = @Content)
	@ApiResponse(responseCode = "403",
			description = "No calendar is connected, or the signature does not check against its webhook's secret.",
			content = @Content)
	ResponseEntity<Void> receive(
			@Parameter(hidden = true) @RequestHeader(name = "Webhook-Signature", required = false) @Nullable String signature,
			@RequestBody byte[] body) {
		return luma.receive(signature, body) ? ResponseEntity.noContent().build() : ResponseEntity.status(403).build();
	}

}
