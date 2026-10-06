package ai.genaifund.beyondpilot.search.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import org.jspecify.annotations.Nullable;

@Schema(name = "RetryEmbeddings", description = "The held-back item to try again at once, or every one when no item is named.")
public record RetryEmbeddingsRequest(
		@Schema(types = { "string", "null" }, allowableValues = { "program", "solution", "talent", "use_case" }) @Pattern(regexp = "program|solution|talent|use_case") @Nullable String kind,
		@Schema(types = { "string", "null" }, format = "uuid") @Nullable UUID itemId) {
}
