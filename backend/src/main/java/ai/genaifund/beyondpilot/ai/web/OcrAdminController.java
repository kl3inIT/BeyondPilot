package ai.genaifund.beyondpilot.ai.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.ai.OcrAdministration;
import ai.genaifund.beyondpilot.ai.dto.OcrProviderTestResponse;
import ai.genaifund.beyondpilot.ai.dto.OcrSettingsResponse;
import ai.genaifund.beyondpilot.ai.dto.ProbeOcrProviderRequest;
import ai.genaifund.beyondpilot.ai.dto.SaveOcrProviderRequest;
import ai.genaifund.beyondpilot.ai.dto.SetDocumentReaderRequest;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The OCR tab of Admin › AI › Providers: OCR providers and what reads a page that is only a picture. */
@RestController
@RequestMapping("/api/ai/admin/ocr")
@Tag(name = "AI administration")
class OcrAdminController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final OcrAdministration administration;

	OcrAdminController(OcrAdministration administration) {
		this.administration = administration;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getOcrSettings", summary = "The OCR providers, and what reads a page that is only a picture",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings, without keys.")
	OcrSettingsResponse ocr(@CurrentActor Actor actor) {
		return administration.ocr(actor);
	}

	@PostMapping(path = "/providers", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "connectOcrProvider", summary = "Connect an OCR provider",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings, with the new provider.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, the adapter is unknown, the address is not an http or https URL, or the key is missing.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Another OCR provider has this name.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503", description = "The server has no key to encrypt provider keys.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	OcrSettingsResponse connectProvider(@CurrentActor Actor actor, @Valid @RequestBody SaveOcrProviderRequest request) {
		return administration.connectProvider(actor, request);
	}

	@PutMapping(path = "/providers/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "changeOcrProvider",
			summary = "Change an OCR provider: its name, address or key, or switch it on or off",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings, with the change.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, the adapter is unknown, the address is not valid, or a key is needed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such provider.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The provider changed since it was read, or another one has this name.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503", description = "The server has no key to encrypt provider keys.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	OcrSettingsResponse changeProvider(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SaveOcrProviderRequest request) {
		return administration.changeProvider(actor, id, request);
	}

	@DeleteMapping(path = "/providers/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "removeOcrProvider", summary = "Remove an OCR provider with its key",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings left. If the provider read pages, nothing does now.")
	@ApiResponse(responseCode = "404", description = "There is no such provider.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	OcrSettingsResponse removeProvider(@CurrentActor Actor actor, @PathVariable UUID id) {
		return administration.removeProvider(actor, id);
	}

	@PostMapping(path = "/providers/test", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "testOcrProvider",
			summary = "Try a connection, saved or not, by sending one small picture; the test spends one call",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "Whether the service read the picture and how long it took.")
	@ApiResponse(responseCode = "400", description = "The adapter is unknown, the address is not valid, or no usable key was given.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	OcrProviderTestResponse testProvider(@CurrentActor Actor actor, @Valid @RequestBody ProbeOcrProviderRequest request) {
		return administration.testProvider(actor, request);
	}

	@PutMapping(path = "/reader", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "setDocumentReader",
			summary = "Choose what reads a page that is only a picture: a model that reads images, or an OCR provider",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings, with the choice.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, both a model and a provider are named, the one named is switched off or has no key, or the model does not read images.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such model or provider.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The reader changed since it was read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	OcrSettingsResponse setReader(@CurrentActor Actor actor, @Valid @RequestBody SetDocumentReaderRequest request) {
		return administration.setReader(actor, request);
	}

}
