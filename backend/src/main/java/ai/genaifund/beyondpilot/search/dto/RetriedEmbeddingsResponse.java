package ai.genaifund.beyondpilot.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "RetriedEmbeddings", description = "How many held-back items the next run of the job tries.")
public record RetriedEmbeddingsResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int count) {
}
