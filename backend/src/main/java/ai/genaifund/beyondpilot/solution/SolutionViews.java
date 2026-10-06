package ai.genaifund.beyondpilot.solution;

import java.text.Normalizer;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.solution.dto.CustomerDeploymentResponse;
import ai.genaifund.beyondpilot.solution.dto.PublicCustomerDeploymentResponse;
import ai.genaifund.beyondpilot.solution.dto.PublicSolutionDeckResponse;
import ai.genaifund.beyondpilot.solution.dto.SolutionDeckResponse;
import ai.genaifund.beyondpilot.solution.dto.SolutionResponse;
import ai.genaifund.beyondpilot.solution.dto.SolutionSummaryResponse;
import ai.genaifund.beyondpilot.solution.persistence.CustomerDeployment;
import ai.genaifund.beyondpilot.solution.persistence.Solution;
import ai.genaifund.beyondpilot.solution.persistence.SolutionQueryRepository;
import org.jspecify.annotations.Nullable;

/** What the application services of the module derive the same way: the response records and a slug. */
final class SolutionViews {

	private static final int MAX_SLUG_LENGTH = 60;

	private SolutionViews() {
	}

	static SolutionResponse solution(Solution solution, String organizationName, List<CustomerDeployment> deployments) {
		return new SolutionResponse(solution.getId(), solution.getOrganizationId(), organizationName,
				solution.getSlug(), solution.getName(), solution.getSummary(), solution.getProblemsSolved(),
				solution.getValueProposition(), solution.getMaturity(), solution.getTraction(), solution.getBuiltWith(),
				solution.getIndustries(), solution.getFocusAreas(), solution.getLanguages(), solution.getDeployment(),
				solution.getBestCustomerProfile(), solution.getWebsite(), solution.getDemoUrl(), deck(solution),
				solution.getStatus(),
				solution.getDecisionReason(), solution.getDecisionMessage(), solution.isListed(), solution.isComplete(),
				solution.getSubmittedAt(), solution.getVersion(), solution.getUpdatedAt(),
				deployments.stream().map(SolutionViews::deployment).toList());
	}

	/** The deck as the organization and the operators see it, or null when the solution names none. */
	private static @Nullable SolutionDeckResponse deck(Solution solution) {
		UUID fileId = solution.getDeckFileId();
		String fileName = solution.getDeckFileName();
		Long sizeBytes = solution.getDeckSizeBytes();
		Instant attachedAt = solution.getDeckAttachedAt();
		if (fileId == null || fileName == null || sizeBytes == null || attachedAt == null) {
			return null;
		}
		return new SolutionDeckResponse(fileId, fileName, sizeBytes, attachedAt);
	}

	/** The deck as the public reads of it: what it is called and how large it is. */
	static @Nullable PublicSolutionDeckResponse publicDeck(Solution solution) {
		String fileName = solution.getDeckFileName();
		Long sizeBytes = solution.getDeckSizeBytes();
		return fileName == null || sizeBytes == null ? null : new PublicSolutionDeckResponse(fileName, sizeBytes);
	}

	static CustomerDeploymentResponse deployment(CustomerDeployment deployment) {
		return new CustomerDeploymentResponse(deployment.getId(), deployment.getTitle(), deployment.getCustomer(),
				deployment.getProblem(), deployment.getDelivered(), deployment.getStage(), deployment.getChannels(),
				deployment.getLanguages(), deployment.getPeriod(), deployment.getResult(), deployment.getStatus(),
				deployment.getDecisionReason(), deployment.getDecisionMessage(), deployment.getVersion(),
				deployment.getUpdatedAt());
	}

	/** An approved deployment as the public reads it, with the solution it used. */
	static PublicCustomerDeploymentResponse publicDeployment(CustomerDeployment deployment, Solution solution) {
		return new PublicCustomerDeploymentResponse(deployment.getId(), deployment.getTitle(), deployment.getCustomer(),
				deployment.getProblem(), deployment.getDelivered(), deployment.getStage(), deployment.getChannels(),
				deployment.getLanguages(), deployment.getPeriod(), deployment.getResult(), solution.getName(),
				solution.getSlug(), Objects.requireNonNull(deployment.getDecidedAt()));
	}

	static SolutionSummaryResponse summary(Solution solution, String organizationName, int deploymentsAwaiting) {
		return new SolutionSummaryResponse(solution.getId(), organizationName, solution.getSlug(), solution.getName(),
				solution.getSummary(), solution.getMaturity(), solution.getStatus(), solution.isListed(),
				solution.getSubmittedAt(), solution.getUpdatedAt(), deploymentsAwaiting);
	}

	static SolutionSummaryResponse summary(SolutionQueryRepository.Row row, String organizationName) {
		return new SolutionSummaryResponse(row.id(), organizationName, row.slug(), row.name(), row.summary(),
				row.maturity(), row.status(), row.listed(), row.submittedAt(), row.updatedAt(),
				row.deploymentsAwaiting());
	}

	/** The codes once each, in the order they were given. */
	static List<String> codes(List<String> codes) {
		return codes.stream().distinct().toList();
	}

	/** What a person typed as a list of names: each trimmed and once, in the order they were given. */
	static List<String> names(List<String> names) {
		return names.stream().map(String::strip).distinct().toList();
	}

	/** What a person typed, or null when they typed nothing. */
	static @Nullable String text(@Nullable String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

	/** An address for the name: its letters and digits in lowercase, joined by hyphens. */
	static String slug(String name) {
		String ascii = Normalizer.normalize(name, Normalizer.Form.NFD)
			.replaceAll("\\p{M}", "")
			.replace('đ', 'd')
			.replace('Đ', 'D')
			.toLowerCase(Locale.ROOT)
			.replaceAll("[^a-z0-9]+", "-")
			.replaceAll("(^-+)|(-+$)", "");
		if (ascii.isEmpty()) {
			return "solution";
		}
		return ascii.length() > MAX_SLUG_LENGTH ? ascii.substring(0, MAX_SLUG_LENGTH).replaceAll("-+$", "") : ascii;
	}
}
