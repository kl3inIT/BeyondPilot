package ai.genaifund.beyondpilot.identity.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.AppConnections;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import java.util.List;

import ai.genaifund.beyondpilot.identity.dto.ConnectedAppResponse;
import ai.genaifund.beyondpilot.identity.dto.ConnectingAppResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
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
	@Operation(operationId = "getConnectingApp", summary = "The AI app waiting for the caller's answer",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The app the consent page shows.")
	@ApiResponse(responseCode = "404", description = "No request of the caller's waits with this app and state.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ConnectingAppResponse connecting(@CurrentActor Actor actor, @RequestParam String clientId,
			@RequestParam String state) {
		return apps.connectingApp(actor, clientId, state);
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listConnectedApps", summary = "The AI apps the caller has connected",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The apps, the latest used first.")
	List<ConnectedAppResponse> connected(@CurrentActor Actor actor) {
		return apps.connectedApps(actor);
	}

	@PostMapping("/{id}/revoke")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "revokeConnectedApp", summary = "End an AI app's connection",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The app can no longer call BeyondPilot.", content = @Content)
	@ApiResponse(responseCode = "404", description = "The caller has not connected this app.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void revoke(@CurrentActor Actor actor, @PathVariable String id) {
		apps.revoke(actor, id);
	}

}
