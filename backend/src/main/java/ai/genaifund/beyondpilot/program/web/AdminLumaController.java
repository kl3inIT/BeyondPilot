package ai.genaifund.beyondpilot.program.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.program.LumaAdministration;
import ai.genaifund.beyondpilot.program.dto.ConnectLumaRequest;
import ai.genaifund.beyondpilot.program.dto.LumaConnectionResponse;
import ai.genaifund.beyondpilot.program.dto.LumaReadResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The Luma calendar BeyondPilot reads, on the Luma tab of Programs (BEY-245). Operators only. */
@RestController
@RequestMapping("/api/program/admin/luma")
@Tag(name = "Program administration")
class AdminLumaController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final LumaAdministration luma;

	AdminLumaController(LumaAdministration luma) {
		this.luma = luma;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getLumaConnection", summary = "The Luma calendar BeyondPilot reads",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The connection, without its key; no calendar when none is connected.")
	LumaConnectionResponse connection(@CurrentActor Actor actor) {
		return luma.connection(actor);
	}

	@PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "connectLuma", summary = "Connect a Luma calendar with its API key",
			description = "Checks the key with Luma, keeps it sealed, makes a webhook on its calendar and reads the calendar soon after. It replaces any calendar connected before.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The connection now.")
	@ApiResponse(responseCode = "400", description = "Luma refused the key, or none was given.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503",
			description = "Luma could not be reached, or this environment cannot keep a key; nothing changed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	LumaConnectionResponse connect(@CurrentActor Actor actor, @Valid @RequestBody ConnectLumaRequest request) {
		return luma.connect(actor, request);
	}

	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "disconnectLuma", summary = "Stop reading the Luma calendar",
			description = "Removes the key and the webhook made with it. The programs the calendar brought stay as they are.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "No calendar is connected.", content = @Content)
	void disconnect(@CurrentActor Actor actor) {
		luma.disconnect(actor);
	}

	@PostMapping(path = "/read", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "readLumaCalendar", summary = "Read the Luma calendar now",
			description = "Does now what the hourly read does: each event still to come becomes or updates a program, and one that left the calendar is unpublished. A read already running finishes first.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "What the read changed.")
	@ApiResponse(responseCode = "400", description = "Luma refused the key; nothing changed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503",
			description = "No Luma calendar is connected, or Luma could not be read; nothing changed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	LumaReadResponse read(@CurrentActor Actor actor) {
		return luma.read(actor);
	}

}
