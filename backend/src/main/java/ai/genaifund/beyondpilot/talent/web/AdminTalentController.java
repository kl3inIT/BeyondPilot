package ai.genaifund.beyondpilot.talent.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.talent.TalentAdministration;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentListRequest;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentListResponse;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentResponse;
import ai.genaifund.beyondpilot.talent.dto.TalentDecisionRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The operators' review of submitted talent profiles. */
@RestController
@RequestMapping("/api/talent/admin/profiles")
@Tag(name = "Talent administration", description = "The talent profiles operators review.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminTalentController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminTalentController.PROBLEM)))
class AdminTalentController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private static final String NOT_FOUND = "There is no such submitted talent profile.";

	private final TalentAdministration talent;

	AdminTalentController(TalentAdministration talent) {
		this.talent = talent;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAdminTalent", summary = "The submitted talent profiles, those waiting for review first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of the profiles the parameters select.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminTalentListResponse list(@CurrentActor Actor actor, @Valid @ParameterObject AdminTalentListRequest request) {
		return talent.list(actor, request);
	}

	@GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getAdminTalent", summary = "One talent profile as an operator reviews it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The profile.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminTalentResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return talent.get(actor, id);
	}

	@PostMapping("/{id}/approve")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "approveTalent", summary = "Approve a talent profile that waits for review",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The profile is approved.", content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The profile is not waiting for review.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void approve(@CurrentActor Actor actor, @PathVariable UUID id) {
		talent.approve(actor, id);
	}

	@PostMapping(path = "/{id}/request-changes", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "requestTalentChanges",
			summary = "Ask the person to change a talent profile that waits for review, with a reason",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "Changes are asked for; the person was emailed.",
			content = @Content)
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The profile is not waiting for review.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void requestChanges(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody TalentDecisionRequest request) {
		talent.requestChanges(actor, id, request);
	}

	@PostMapping(path = "/{id}/remove", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "removeTalent", summary = "Remove an approved talent profile from the public, with a reason",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The profile is removed; the person was emailed.",
			content = @Content)
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The profile is not approved.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void remove(@CurrentActor Actor actor, @PathVariable UUID id, @Valid @RequestBody TalentDecisionRequest request) {
		talent.remove(actor, id, request);
	}
}
