package ai.genaifund.beyondpilot.solution;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/** A customer deployment GenAI Fund approved, as another module reads what it says. */
public record CustomerCase(UUID id, String customer, String title, String problem, String delivered,
		@Nullable String result) {
}
