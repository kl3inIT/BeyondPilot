package ai.genaifund.beyondpilot.identity.web;

import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.AppConnections;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.identity.dto.PersonConnectedAppResponse;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/identity/admin/apps")
@Tag(name = "Identity", description = "Who is signed in.")
class AppsAdminController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final AppConnections apps;

	AppsAdminController(AppConnections apps) {
		this.apps = apps;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listEveryConnectedApp", summary = "Every person's connected AI apps",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The connections, the latest used first.")
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	List<PersonConnectedAppResponse> list(@CurrentActor Actor actor) {
		return apps.everyConnection(actor);
	}

	@PostMapping("/{accountId}/{id}/revoke")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "revokePersonsApp", summary = "End a person's connection with an AI app",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "Revoked.", content = @Content)
	@ApiResponse(responseCode = "404", description = "That person has not connected that app.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void revoke(@CurrentActor Actor actor, @PathVariable UUID accountId, @PathVariable String id) {
		apps.revokeFor(actor, accountId, id);
	}

}
