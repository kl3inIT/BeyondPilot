package ai.genaifund.beyondpilot.identity.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.AppConnections;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.identity.dto.ConnectingAppResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/identity/apps")
@Tag(name = "Identity", description = "Who is signed in.")
class AppsController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final AppConnections apps;

	AppsController(AppConnections apps) {
		this.apps = apps;
	}

	@GetMapping(path = "/connecting", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getConnectingApp", summary = "The AI app asking to connect",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The app the consent page names.")
	@ApiResponse(responseCode = "404", description = "No such app may sign in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ConnectingAppResponse connecting(@CurrentActor Actor actor, @RequestParam String clientId) {
		return apps.connectingApp(actor, clientId);
	}

}
