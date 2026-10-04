package ai.genaifund.beyondpilot.identity.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.AccountAdministration;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.identity.dto.AccountListRequest;
import ai.genaifund.beyondpilot.identity.dto.AccountListResponse;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The operators' work on accounts. Each change is a command on the account, not an edit of one of its fields. */
@RestController
@RequestMapping("/api/identity/accounts")
@Tag(name = "Accounts", description = "The accounts operators manage.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AccountsController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AccountsController.PROBLEM)))
class AccountsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private static final String NOT_FOUND = "There is no such account.";

	private final AccountAdministration accounts;

	AccountsController(AccountAdministration accounts) {
		this.accounts = accounts;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAccounts", summary = "The accounts, latest sign-in first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of the accounts the parameters select.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AccountListResponse list(@CurrentActor Actor actor, @Valid @ParameterObject AccountListRequest request) {
		return accounts.list(actor, request);
	}

	@PostMapping("/{id}/disable")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "disableAccount", summary = "Stop an account from signing in",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The account is disabled.", content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The account is the caller's own.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void disable(@CurrentActor Actor actor, @PathVariable UUID id) {
		accounts.disable(actor, id);
	}

	@PostMapping("/{id}/enable")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "enableAccount", summary = "Let a disabled account sign in again",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The account is active.", content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void enable(@CurrentActor Actor actor, @PathVariable UUID id) {
		accounts.enable(actor, id);
	}

	@PostMapping("/{id}/grant-operator")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "grantOperator", summary = "Make an account an operator",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The account is an operator.", content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void grantOperator(@CurrentActor Actor actor, @PathVariable UUID id) {
		accounts.grantOperator(actor, id);
	}

	@PostMapping("/{id}/withdraw-operator")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "withdrawOperator", summary = "Take the operator role from an account",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The account is not an operator.", content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The account is the caller's own, or the server configuration names it as an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void withdrawOperator(@CurrentActor Actor actor, @PathVariable UUID id) {
		accounts.withdrawOperator(actor, id);
	}

}
