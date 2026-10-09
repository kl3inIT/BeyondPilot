package ai.genaifund.beyondpilot.identity.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.AppHostAdministration;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.identity.dto.AllowOtherHostsRequest;
import ai.genaifund.beyondpilot.identity.dto.AppHostRequest;
import ai.genaifund.beyondpilot.identity.dto.AppHostsResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/identity/admin/app-hosts")
@Tag(name = "Identity", description = "Who is signed in.")
class AppHostsController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final AppHostAdministration hosts;

	AppHostsController(AppHostAdministration hosts) {
		this.hosts = hosts;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getAppHosts", summary = "Which AI apps may connect to the MCP servers",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The reviewed hosts and whether others may connect.")
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AppHostsResponse get(@CurrentActor Actor actor) {
		return hosts.hosts(actor);
	}

	@PostMapping("/add")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "addAppHost", summary = "Mark a host's apps as reviewed",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The host is in the list.", content = @Content)
	@ApiResponse(responseCode = "400", description = "It is not a host name.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void add(@CurrentActor Actor actor, @Valid @RequestBody AppHostRequest request) {
		hosts.add(actor, request.host());
	}

	@PostMapping("/remove")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "removeAppHost", summary = "Take a host off the reviewed list",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The host is no longer reviewed.", content = @Content)
	@ApiResponse(responseCode = "404", description = "The host is not in the list.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void remove(@CurrentActor Actor actor, @Valid @RequestBody AppHostRequest request) {
		hosts.remove(actor, request.host());
	}

	@PutMapping("/other-hosts")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "allowOtherAppHosts", summary = "Let apps of other hosts connect, or stop them",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "Saved.", content = @Content)
	void allowOtherHosts(@CurrentActor Actor actor, @RequestBody AllowOtherHostsRequest request) {
		hosts.allowOtherHosts(actor, request.allowed());
	}

}
