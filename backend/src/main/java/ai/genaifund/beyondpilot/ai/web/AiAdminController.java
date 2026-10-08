package ai.genaifund.beyondpilot.ai.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.ai.AiAdministration;
import ai.genaifund.beyondpilot.ai.dto.AddChatModelsRequest;
import ai.genaifund.beyondpilot.ai.dto.ChatProviderTestResponse;
import ai.genaifund.beyondpilot.ai.dto.ChatSettingsResponse;
import ai.genaifund.beyondpilot.ai.dto.ProbeChatProviderRequest;
import ai.genaifund.beyondpilot.ai.dto.ReportedChatModelsResponse;
import ai.genaifund.beyondpilot.ai.dto.SaveChatModelRequest;
import ai.genaifund.beyondpilot.ai.dto.SaveChatProviderRequest;
import ai.genaifund.beyondpilot.ai.dto.SetTaskModelRequest;
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

/** The Chat tab of Admin › AI › Providers: chat providers, their models and the model each task uses. */
@RestController
@RequestMapping("/api/ai/admin")
@Tag(name = "AI administration",
		description = "What operators do in the Chat tab of Admin › AI › Providers: connect chat providers, enable their models and choose the model each task uses.")
class AiAdminController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final AiAdministration administration;

	AiAdminController(AiAdministration administration) {
		this.administration = administration;
	}

	@GetMapping(path = "/chat", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getChatSettings", summary = "The chat providers with their models, and the model each task uses",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings, without keys.")
	ChatSettingsResponse chat(@CurrentActor Actor actor) {
		return administration.chat(actor);
	}

	@PostMapping(path = "/chat/providers", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "connectChatProvider", summary = "Connect a chat provider",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings, with the new provider.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, the adapter is unknown, the address is not an http or https URL, or the key is missing.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Another chat provider has this name.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503", description = "The server has no key to encrypt provider keys.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ChatSettingsResponse connectProvider(@CurrentActor Actor actor, @Valid @RequestBody SaveChatProviderRequest request) {
		return administration.connectProvider(actor, request);
	}

	@PutMapping(path = "/chat/providers/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "changeChatProvider",
			summary = "Change a chat provider: its name, address or key, or switch it on or off",
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
	ChatSettingsResponse changeProvider(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SaveChatProviderRequest request) {
		return administration.changeProvider(actor, id, request);
	}

	@DeleteMapping(path = "/chat/providers/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "removeChatProvider", summary = "Remove a chat provider with its key and its models",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings left. A task that used one of its models is unset.")
	@ApiResponse(responseCode = "404", description = "There is no such provider.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ChatSettingsResponse removeProvider(@CurrentActor Actor actor, @PathVariable UUID id) {
		return administration.removeProvider(actor, id);
	}

	@PostMapping(path = "/chat/providers/test", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "testChatProvider",
			summary = "Try a connection, saved or not, by listing the provider's models; no tokens are spent",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "Whether the provider answered, how many models it listed and how long it took.")
	@ApiResponse(responseCode = "400", description = "The adapter is unknown, the address is not valid, or no usable key was given.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ChatProviderTestResponse testProvider(@CurrentActor Actor actor, @Valid @RequestBody ProbeChatProviderRequest request) {
		return administration.testProvider(actor, request);
	}

	@PostMapping(path = "/chat/providers/reported-models", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listReportedChatModels",
			summary = "The models a provider lists, saved or not, with their limits, capabilities and prices",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The models, by name.")
	@ApiResponse(responseCode = "400", description = "The adapter is unknown, the address is not valid, no usable key was given, the key was refused, or the answer was not the API's.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503", description = "The provider could not be reached.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ReportedChatModelsResponse reportedModels(@CurrentActor Actor actor,
			@Valid @RequestBody ProbeChatProviderRequest request) {
		return administration.reportedModels(actor, request);
	}

	@PostMapping(path = "/chat/providers/{id}/models", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "addChatModels", summary = "Enable models on a chat provider",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings, with the models.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, or an answer limit does not fit its context window.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such provider.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The provider already has one of the models.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ChatSettingsResponse addModels(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody AddChatModelsRequest request) {
		return administration.addModels(actor, id, request);
	}

	@PutMapping(path = "/chat/models/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "changeChatModel", summary = "Correct a model's limits, capabilities or prices",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings, with the change.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, or the answer limit does not fit the context window.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such model.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The model changed since it was read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ChatSettingsResponse changeModel(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SaveChatModelRequest request) {
		return administration.changeModel(actor, id, request);
	}

	@DeleteMapping(path = "/chat/models/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "removeChatModel", summary = "Remove a model from its provider",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings left. A task that used the model is unset.")
	@ApiResponse(responseCode = "404", description = "There is no such model.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ChatSettingsResponse removeModel(@CurrentActor Actor actor, @PathVariable UUID id) {
		return administration.removeModel(actor, id);
	}

	@PutMapping(path = "/chat/tasks/{task}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "setTaskModel", summary = "Choose the model a task uses, and how hard it reasons",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings, with the choice.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, or the model's provider is switched off or has no key.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such task or model.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The task's model changed since it was read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ChatSettingsResponse setTaskModel(@CurrentActor Actor actor, @PathVariable String task,
			@Valid @RequestBody SetTaskModelRequest request) {
		return administration.setTaskModel(actor, task, request);
	}

}
