package ai.genaifund.beyondpilot.perk.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SavePerk",
		description = "A perk as its form holds it. What its way of getting it does not use is ignored.")
public record SavePerkRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "What it is called.") @NotBlank @Size(max = 80) String title,
		@Schema(types = { "string", "null" },
				description = "The figure its card shows large, such as $1,000.") @Nullable @Size(max = 40) String value,
		@Schema(types = { "string", "null" },
				description = "One or two sentences under its title.") @Nullable @Size(max = 200) String summary,
		@Schema(types = { "string", "null" }, description = "What it is, in full.") @Nullable @Size(max = 4000) String about,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How to get it, in order.") @NotNull @Size(
				max = PerkCodes.MAX_STEPS) List<@NotBlank @Size(max = 300) String> steps,
		@Schema(types = { "string", "null" }) @Nullable @Size(max = 4000) String terms,
		@Schema(types = { "string", "null" }, description = "The https address of its full terms.") @Nullable @Size(
				max = 2048) @Pattern(regexp = PerkCodes.HTTPS) String termsUrl,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "everyone", "members", "applicants",
				"shortlisted" }) @NotNull @Pattern(regexp = PerkCodes.AUDIENCE) String audience,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The program whose applicants or shortlist may get it.") @Nullable UUID programId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "link", "code", "codes",
				"request" }) @NotNull @Pattern(regexp = PerkCodes.WAY) String way,
		@Schema(types = { "string", "null" }, description = "The partner's https page, for a link perk.") @Nullable @Size(
				max = 2048) @Pattern(regexp = PerkCodes.HTTPS) String url,
		@Schema(types = { "string", "null" },
				description = "The code its audience gets, for a code perk.") @Nullable @Size(max = 200) String code,
		@Schema(types = { "string", "null" }, description = "Where a code is redeemed.") @Nullable @Size(
				max = 2048) @Pattern(regexp = PerkCodes.HTTPS) String redeemUrl,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "What a request asks, for a request perk.") @NotNull @Size(
				max = PerkCodes.MAX_QUESTIONS) List<@NotNull @Valid PerkQuestionEntry> questions,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "For a request perk: true when its partner grants or declines each request; otherwise a request is granted when it is sent.") boolean requireApproval,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True when it is got once per person; otherwise once per organization.") boolean perPerson,
		@Schema(types = { "integer", "null" },
				description = "How many may get it; null for as many as come. A link perk has no places.") @Nullable @Min(
						1) @Max(100000) Integer places,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant startsAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant endsAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The solutions of its organization it goes with.") @NotNull @Size(
				max = PerkCodes.MAX_SOLUTIONS) List<@NotNull UUID> solutionIds,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "The version the form read; left out for a new perk. A save is refused when the perk changed since.") @Nullable Long version) {
}
