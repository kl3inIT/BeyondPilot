package ai.genaifund.beyondpilot.notification.web;

import ai.genaifund.beyondpilot.notification.EmailSettingsAdministration;
import ai.genaifund.beyondpilot.notification.dto.EmailSettingsResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailTestResponse;
import ai.genaifund.beyondpilot.notification.dto.SaveEmailAppearanceRequest;
import ai.genaifund.beyondpilot.notification.dto.SaveEmailSettingsRequest;
import jakarta.validation.Valid;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The email settings operators keep: the provider and its connection, the sender and the appearance. */
@RestController
@RequestMapping("/api/notification/admin/email/settings")
@Tag(name = "Email administration", description = "Who delivers BeyondPilot's email, its wording, what was sent and the addresses it is not sent to.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = EmailSettingsController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = EmailSettingsController.PROBLEM)))
class EmailSettingsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final EmailSettingsAdministration settings;

	EmailSettingsController(EmailSettingsAdministration settings) {
		this.settings = settings;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getEmailSettings", summary = "The email settings, without their secrets", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings.")
	EmailSettingsResponse get(@CurrentActor Actor actor) {
		return settings.get(actor);
	}

	@PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveEmailSettings", summary = "Choose who delivers email and as whom", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings as saved, with their new version.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, or the provider chosen lacks a field or its secret.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The settings changed since they were read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503", description = "A secret was given but the server has no key to encrypt it.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailSettingsResponse save(@CurrentActor Actor actor, @Valid @RequestBody SaveEmailSettingsRequest request) {
		return settings.save(actor, request);
	}

	@PostMapping(path = "/test", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "testEmailSettings",
			summary = "Send a test through the settings as the form holds them, to the caller's own address", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "Whether the provider took the test, and why not.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, or the provider chosen lacks a field or its secret.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503", description = "A secret was given but the server has no key to encrypt it.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailTestResponse test(@CurrentActor Actor actor, @Valid @RequestBody SaveEmailSettingsRequest request) {
		return settings.test(actor, request);
	}

	@PutMapping(path = "/appearance", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveEmailAppearance", summary = "Set the accent colour and footer note of every email", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings as saved, with their new version.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The settings changed since they were read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailSettingsResponse saveAppearance(@CurrentActor Actor actor,
			@Valid @RequestBody SaveEmailAppearanceRequest request) {
		return settings.saveAppearance(actor, request);
	}

}
