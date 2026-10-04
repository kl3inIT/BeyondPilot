package ai.genaifund.beyondpilot.identity.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AccountList", description = "One page of accounts, latest sign-in first.")
public record AccountListResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AccountSummaryResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many accounts a page holds.") int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many accounts match, over all pages.") long total) {
}
