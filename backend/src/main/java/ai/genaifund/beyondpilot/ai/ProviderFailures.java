package ai.genaifund.beyondpilot.ai;

import java.util.Set;

import com.anthropic.errors.AnthropicServiceException;
import com.openai.errors.OpenAIServiceException;
import org.jspecify.annotations.Nullable;

/** What a failed call to a provider says about the next one, read from the status the provider answered with. */
public final class ProviderFailures {

	/**
	 * The statuses with which a provider refuses the request itself: what was sent, the key or the model. The same
	 * request is refused again, so nothing is gained by waiting. A limit that was reached (429) and a provider in
	 * trouble (5xx) are not among them.
	 */
	private static final Set<Integer> REFUSALS = Set.of(400, 401, 403, 404, 422);

	private ProviderFailures() {
	}

	/** Whether the provider refused the request itself, so that sending it again would be refused again. */
	public static boolean refused(Throwable failure) {
		Integer status = status(failure);
		return status != null && REFUSALS.contains(status);
	}

	/** The status the provider answered with, from whichever exception in the chain carries one. */
	static @Nullable Integer status(Throwable failure) {
		Throwable cause = failure;
		for (int depth = 0; cause != null && depth < 10; depth++) {
			if (cause instanceof OpenAIServiceException refused) {
				return refused.statusCode();
			}
			if (cause instanceof AnthropicServiceException refused) {
				return refused.statusCode();
			}
			cause = cause.getCause();
		}
		return null;
	}

}
