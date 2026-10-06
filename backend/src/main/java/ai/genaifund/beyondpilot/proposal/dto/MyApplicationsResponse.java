package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "MyApplications", description = "The person's applications, the most recently changed first.")
public record MyApplicationsResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MyApplicationResponse> items) {
}
