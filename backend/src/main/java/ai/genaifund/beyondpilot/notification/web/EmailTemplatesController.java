package ai.genaifund.beyondpilot.notification.web;

import ai.genaifund.beyondpilot.notification.EmailTemplateAdministration;
import ai.genaifund.beyondpilot.notification.dto.EmailDraftRequest;
import ai.genaifund.beyondpilot.notification.dto.EmailPreviewResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailTemplateListResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailTemplateResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailTestResponse;
import ai.genaifund.beyondpilot.notification.dto.SaveEmailTemplateRequest;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The wording of each kind of email, which operators change and put back to the default. */
@RestController
@RequestMapping("/api/notification/admin/email/templates")
@Tag(name = "Email administration", description = "Who delivers BeyondPilot's email, its wording, what was sent and the addresses it is not sent to.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = EmailTemplatesController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = EmailTemplatesController.PROBLEM)))
class EmailTemplatesController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final EmailTemplateAdministration templates;

	EmailTemplatesController(EmailTemplateAdministration templates) {
		this.templates = templates;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listEmailTemplates", summary = "Every kind of email operators word", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The kinds, with the subject in use and who changed it.")
	EmailTemplateListResponse list(@CurrentActor Actor actor) {
		return templates.list(actor);
	}

	@GetMapping(path = "/{kind}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getEmailTemplate", summary = "One kind's wording, its default and its variables", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The template.")
	@ApiResponse(responseCode = "404", description = "There is no such kind of email.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Operators do not word this kind.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailTemplateResponse get(@CurrentActor Actor actor, @PathVariable String kind) {
		return templates.get(actor, kind);
	}

	@PutMapping(path = "/{kind}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveEmailTemplate", summary = "Replace one kind's wording", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The template as saved, with its new version.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, or the template does not pass the checks; preview it to see why.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such kind of email.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Operators do not word this kind, or the wording changed since it was read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailTemplateResponse save(@CurrentActor Actor actor, @PathVariable String kind,
			@Valid @RequestBody SaveEmailTemplateRequest request) {
		return templates.save(actor, kind, request);
	}

	@DeleteMapping(path = "/{kind}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "resetEmailTemplate", summary = "Put one kind back to its default wording", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The template, now the default.")
	@ApiResponse(responseCode = "404", description = "There is no such kind of email.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Operators do not word this kind.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailTemplateResponse reset(@CurrentActor Actor actor, @PathVariable String kind) {
		return templates.reset(actor, kind);
	}

	@PostMapping(path = "/{kind}/preview", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "previewEmailTemplate",
			summary = "Render a draft with sample values, and say what keeps it from being saved", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The rendering and its problems.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such kind of email.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Operators do not word this kind.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailPreviewResponse preview(@CurrentActor Actor actor, @PathVariable String kind,
			@Valid @RequestBody EmailDraftRequest request) {
		return templates.preview(actor, kind, request);
	}

	@PostMapping(path = "/{kind}/test", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "testEmailTemplate", summary = "Send a draft with sample values to the caller's own address", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "Whether the provider took the test, and why not.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, or the draft does not pass the checks.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such kind of email.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Operators do not word this kind.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	EmailTestResponse test(@CurrentActor Actor actor, @PathVariable String kind,
			@Valid @RequestBody EmailDraftRequest request) {
		return templates.test(actor, kind, request);
	}

}
