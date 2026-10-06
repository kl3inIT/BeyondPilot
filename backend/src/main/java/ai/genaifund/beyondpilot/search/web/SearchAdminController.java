package ai.genaifund.beyondpilot.search.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.search.SearchAdministration;
import ai.genaifund.beyondpilot.search.dto.AiProviderTestResponse;
import ai.genaifund.beyondpilot.search.dto.AiProvidersResponse;
import ai.genaifund.beyondpilot.search.dto.ChooseEmbeddingModelRequest;
import ai.genaifund.beyondpilot.search.dto.RetriedEmbeddingsResponse;
import ai.genaifund.beyondpilot.search.dto.RetryEmbeddingsRequest;
import ai.genaifund.beyondpilot.search.dto.SaveAiProviderRequest;
import ai.genaifund.beyondpilot.search.dto.SearchIndexResponse;
import ai.genaifund.beyondpilot.search.dto.SetSemanticSearchRequest;
import ai.genaifund.beyondpilot.search.dto.TestAiProviderRequest;
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

/** Admin › AI: the embedding providers, the model search embeds with, semantic search and the index. */
@RestController
@RequestMapping("/api/search/admin")
@Tag(name = "AI and search administration",
		description = "The AI providers operators connect, the model search embeds with, and the state of the search index.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = SearchAdminController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = SearchAdminController.PROBLEM)))
class SearchAdminController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final SearchAdministration administration;

	SearchAdminController(SearchAdministration administration) {
		this.administration = administration;
	}

	@GetMapping(path = "/providers", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAiProviders", summary = "The embedding providers and the model in use, without keys",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The providers.")
	AiProvidersResponse providers(@CurrentActor Actor actor) {
		return administration.providers(actor);
	}

	@PostMapping(path = "/providers", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "createAiProvider", summary = "Connect an embedding provider",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The providers, with the new one.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, the address is not an https URL, or the key is missing.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Another provider has this name.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503", description = "The server has no key to encrypt provider keys.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AiProvidersResponse createProvider(@CurrentActor Actor actor, @Valid @RequestBody SaveAiProviderRequest request) {
		return administration.createProvider(actor, request);
	}

	@PutMapping(path = "/providers/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "updateAiProvider", summary = "Change an embedding provider: its name, address or key",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The providers, with the change.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, the address is not an https URL, or a key is needed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such provider.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The provider changed since it was read, or another one has this name.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503", description = "The server has no key to encrypt provider keys.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AiProvidersResponse updateProvider(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SaveAiProviderRequest request) {
		return administration.updateProvider(actor, id, request);
	}

	@DeleteMapping(path = "/providers/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "deleteAiProvider", summary = "Delete an embedding provider and its key",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The providers left.")
	@ApiResponse(responseCode = "404", description = "There is no such provider.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Search embeds with this provider.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AiProvidersResponse deleteProvider(@CurrentActor Actor actor, @PathVariable UUID id) {
		return administration.deleteProvider(actor, id);
	}

	@PostMapping(path = "/providers/test", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "testAiProvider",
			summary = "Embed one test sentence with a connection as the editor holds it, saved or not",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "Whether the provider embedded it, and why not.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, the model is not offered, or no key can be used.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The provider named for its saved key does not exist.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AiProviderTestResponse testProvider(@CurrentActor Actor actor, @Valid @RequestBody TestAiProviderRequest request) {
		return administration.test(actor, request);
	}

	@PutMapping(path = "/embedding-model", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "chooseEmbeddingModel",
			summary = "Embed with this provider and model from now on, after it embeds a test sentence",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The providers, with the model in use.")
	@ApiResponse(responseCode = "400", description = "A member is not valid, the model is not offered, the provider has no key, or it did not embed the test.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such provider.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The search settings changed since they were read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AiProvidersResponse chooseModel(@CurrentActor Actor actor, @Valid @RequestBody ChooseEmbeddingModelRequest request) {
		return administration.chooseModel(actor, request);
	}

	@GetMapping(path = "/index", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getSearchIndex", summary = "The state of the search index and of semantic search",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The state.")
	SearchIndexResponse index(@CurrentActor Actor actor) {
		return administration.searchIndex(actor);
	}

	@PutMapping(path = "/semantic", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "setSemanticSearch", summary = "Turn semantic search on or off",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The state, with the change.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The search settings changed since they were read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	SearchIndexResponse setSemantic(@CurrentActor Actor actor, @Valid @RequestBody SetSemanticSearchRequest request) {
		return administration.setSemantic(actor, request);
	}

	@PostMapping(path = "/index/rebuild", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "rebuildSearchIndex", summary = "Rebuild the index from what the modules publish now",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The state, with what the rebuild did.")
	SearchIndexResponse rebuild(@CurrentActor Actor actor) {
		return administration.rebuild(actor);
	}

	@PostMapping(path = "/index/retry", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "retrySearchEmbeddings",
			summary = "Let held-back items be embedded at the next run: one, or all",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "How many items the next run tries.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	RetriedEmbeddingsResponse retry(@CurrentActor Actor actor, @Valid @RequestBody RetryEmbeddingsRequest request) {
		return administration.retry(actor, request);
	}

}
