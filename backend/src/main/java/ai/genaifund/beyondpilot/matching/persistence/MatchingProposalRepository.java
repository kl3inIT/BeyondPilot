package ai.genaifund.beyondpilot.matching.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * The evaluations of the proposals a use case received (BEY-229): one row per proposal, replaced each time a run
 * judges it again.
 */
@Repository
public class MatchingProposalRepository {

	private final JdbcClient jdbc;

	private final JsonMapper json;

	MatchingProposalRepository(JdbcClient jdbc, JsonMapper json) {
		this.jdbc = jdbc;
		this.json = json;
	}

	/**
	 * What a run kept for one proposal.
	 * @param stamp when the proposal was sent or last edited, as it was when it was judged
	 * @param findings the answer per requirement and for the problem, as it is stored
	 * @param unread the sources that held no text
	 * @param fingerprint what was judged
	 */
	public record Evaluation(UUID proposalId, UUID useCaseId, Instant stamp, int requiredMet, int requiredTotal,
			Map<String, Object> findings, @Nullable String summary, List<String> unread, String fingerprint,
			Instant judgedAt) {
	}

	/** The evaluations kept for the proposals of a use case, by proposal. */
	public Map<UUID, Evaluation> of(UUID useCaseId) {
		Map<UUID, Evaluation> kept = new LinkedHashMap<>();
		jdbc.sql("""
				select proposal_id, use_case_id, stamp, required_met, required_total, cast(findings as text) as findings,
				       summary, array_to_string(unread, ',') as unread, fingerprint, judged_at
				from matching_proposal where use_case_id = :useCaseId
				""").param("useCaseId", useCaseId).query(row -> {
			String unread = row.getString("unread");
			UUID proposalId = row.getObject("proposal_id", UUID.class);
			kept.put(proposalId, new Evaluation(proposalId, row.getObject("use_case_id", UUID.class),
					row.getTimestamp("stamp").toInstant(), row.getInt("required_met"), row.getInt("required_total"),
					json.readValue(row.getString("findings"), new TypeReference<Map<String, Object>>() {
					}), row.getString("summary"),
					unread == null || unread.isEmpty() ? List.of() : List.of(unread.split(",")),
					row.getString("fingerprint"), row.getTimestamp("judged_at").toInstant()));
		});
		return kept;
	}

	/** Keeps the evaluation of one proposal, in the place of the one kept before. */
	public void judged(UUID proposalId, UUID useCaseId, Instant stamp, UUID runId, MatchingRepository.Judged judged) {
		jdbc.sql("""
				insert into matching_proposal (proposal_id, use_case_id, stamp, required_met, required_total, findings,
				    summary, unread, fingerprint, run_id, judged_at)
				values (:proposalId, :useCaseId, :stamp, :requiredMet, :requiredTotal, cast(:findings as jsonb), :summary,
				    string_to_array(:unread, ','), :fingerprint, :runId, now())
				on conflict (proposal_id) do update
				set use_case_id = excluded.use_case_id, stamp = excluded.stamp, required_met = excluded.required_met,
				    required_total = excluded.required_total, findings = excluded.findings, summary = excluded.summary,
				    unread = excluded.unread, fingerprint = excluded.fingerprint, run_id = excluded.run_id,
				    judged_at = excluded.judged_at
				""")
			.param("proposalId", proposalId)
			.param("useCaseId", useCaseId)
			.param("stamp", Timestamp.from(stamp))
			.param("requiredMet", judged.requiredMet())
			.param("requiredTotal", judged.requiredTotal())
			.param("findings", json.writeValueAsString(judged.findings()))
			.param("summary", judged.summary(), java.sql.Types.VARCHAR)
			.param("unread", String.join(",", judged.unread()))
			.param("fingerprint", judged.fingerprint())
			.param("runId", runId)
			.update();
	}

	/**
	 * Notes that a run found a proposal's material and the requirements unchanged since its evaluation, though the
	 * proposal was saved again: the evaluation stands for what it says now.
	 */
	public void unchanged(UUID proposalId, Instant stamp) {
		jdbc.sql("update matching_proposal set stamp = :stamp where proposal_id = :proposalId")
			.param("stamp", Timestamp.from(stamp))
			.param("proposalId", proposalId)
			.update();
	}

}
