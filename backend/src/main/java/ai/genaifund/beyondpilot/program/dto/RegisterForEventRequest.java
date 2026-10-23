package ai.genaifund.beyondpilot.program.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "RegisterForEvent",
		description = "A registration for an event: the name Luma shows the host and the answers to its questions.")
public record RegisterForEventRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 200) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The formVersion the form was filled against.") @NotBlank @Size(max = 64) String formVersion,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "One per question answered; those answered from the account are left out.") @NotNull @Size(
						max = 100) List<@Valid @NotNull Answer> answers) {

	@Schema(name = "EventAnswer",
			description = "An answer, in the field its question's type takes: text for text, a single select, an address, a phone number and a handle; choices for a multiple select; agreed for agree-check and terms; company and jobTitle for company.")
	public record Answer(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 100) String questionId,
			@Schema(types = { "string", "null" }) @Size(max = 10_000) @Nullable String text,
			@Schema(types = { "array", "null" }) @Size(max = 300) @Nullable List<@NotNull @Size(max = 500) String> choices,
			@Schema(types = { "boolean", "null" }) @Nullable Boolean agreed,
			@Schema(types = { "string", "null" }) @Size(max = 200) @Nullable String company,
			@Schema(types = { "string", "null" }) @Size(max = 200) @Nullable String jobTitle) {
	}

}
