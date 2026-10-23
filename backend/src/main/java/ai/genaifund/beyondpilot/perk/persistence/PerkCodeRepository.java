package ai.genaifund.beyondpilot.perk.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The single-use codes of a perk given as a list: loaded by an operator, each given to one claim. */
@Repository
public class PerkCodeRepository {

	private final JdbcClient jdbc;

	PerkCodeRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Adds the codes the perk does not hold yet; answers how many were added. */
	public int add(UUID perkId, Collection<String> codes) {
		int added = 0;
		for (String code : codes) {
			added += jdbc.sql("""
					insert into perk_code (id, perk_id, code, created_at)
					values (:id, :perkId, :code, clock_timestamp())
					on conflict (perk_id, code) do nothing
					""").param("id", UUID.randomUUID()).param("perkId", perkId).param("code", code).update();
		}
		return added;
	}

	/**
	 * Gives the claim the next free code of the perk, skipping a code another transaction is giving at this moment.
	 * Empty when none is left.
	 */
	public Optional<String> give(UUID perkId, UUID claimId) {
		return jdbc.sql("""
				update perk_code set claim_id = :claimId
				where id = (select id from perk_code
				            where perk_id = :perkId and claim_id is null
				            order by created_at, id
				            limit 1
				            for update skip locked)
				returning code
				""").param("claimId", claimId).param("perkId", perkId).query(String.class).optional();
	}

	/** Frees the code a claim held, when the claim did not go through. */
	public void release(UUID claimId) {
		jdbc.sql("update perk_code set claim_id = null where claim_id = :claimId").param("claimId", claimId).update();
	}

	/** How many codes the perk holds, and how many are free. */
	public Stock stock(UUID perkId) {
		return jdbc.sql("""
				select count(*) as loaded, count(*) filter (where claim_id is null) as free
				from perk_code where perk_id = :perkId
				""")
			.param("perkId", perkId)
			.query((row, index) -> new Stock(row.getInt("loaded"), row.getInt("free")))
			.single();
	}

	/** The codes a perk holds and the free ones, for each perk asked; a perk with none is absent. */
	public List<PerkStock> stocks(Collection<UUID> perkIds) {
		if (perkIds.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("""
				select perk_id, count(*) as loaded, count(*) filter (where claim_id is null) as free
				from perk_code where perk_id in (:perkIds) group by perk_id
				""")
			.param("perkIds", perkIds)
			.query((row, index) -> new PerkStock(row.getObject("perk_id", UUID.class),
					new Stock(row.getInt("loaded"), row.getInt("free"))))
			.list();
	}

	public record Stock(int loaded, int free) {
	}

	public record PerkStock(UUID perkId, Stock stock) {
	}
}
