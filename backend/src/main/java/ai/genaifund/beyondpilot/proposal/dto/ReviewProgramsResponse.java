package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ReviewPrograms", description = "The programs whose applications the caller scores.")
public record ReviewProgramsResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ReviewProgramResponse> items) {
}
