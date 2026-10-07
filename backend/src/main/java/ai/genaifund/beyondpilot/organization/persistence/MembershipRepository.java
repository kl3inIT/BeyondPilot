package ai.genaifund.beyondpilot.organization.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Who belongs to an organization, who was asked to and who asked to: members, invitations and join requests. The
 * rows are small and change by single statements, so they are written here and not through entities.
 */
@Repository
public class MembershipRepository {

	public static final String OWNER = "owner";

	public static final String MEMBER = "member";

	private static final String MEMBERS = """
			select organization_id, account_id, role, job_title, created_at from organization_member
			""";

	private static final String INVITATIONS = """
			select id, organization_id, email, role, invited_by_account_id, created_at, expires_at
			from organization_invitation
			""";

	private static final String REQUESTS = """
			select id, organization_id, account_id, message, claim, created_at from organization_join_request
			""";

	private final JdbcClient jdbc;

	MembershipRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** One member of an organization. */
	public record Member(UUID organizationId, UUID accountId, String role, @Nullable String jobTitle,
			Instant joinedAt) {

		public boolean isOwner() {
			return OWNER.equals(role);
		}
	}

	/** One open invitation: nobody answered it and it has not lapsed. */
	public record Invitation(UUID id, UUID organizationId, String email, String role, UUID invitedByAccountId,
			Instant createdAt, Instant expiresAt) {
	}

	/**
	 * One open request to join.
	 * @param claim whether nobody owns the organization, so GenAI Fund decides and approval makes the person its owner
	 */
	public record JoinRequest(UUID id, UUID organizationId, UUID accountId, @Nullable String message, boolean claim,
			Instant createdAt) {
	}

	/** The request a person made last, once it was decided or withdrawn. */
	public record ClosedRequest(UUID organizationId, String status, boolean claim, Instant decidedAt) {

		public boolean isDeclined() {
			return "declined".equals(status);
		}
	}

	public Optional<Member> memberOf(UUID accountId) {
		return jdbc.sql(MEMBERS + "where account_id = ?").param(accountId).query(MembershipRepository::member).optional();
	}

	/** The members of an organization, owners first, then in the order they joined. */
	public List<Member> members(UUID organizationId) {
		return jdbc.sql(MEMBERS + """
				where organization_id = ?
				order by case role when 'owner' then 0 else 1 end, created_at, account_id
				""").param(organizationId).query(MembershipRepository::member).list();
	}

	/** One page of the members of an organization, in the order of {@link #members(UUID)}. */
	public List<Member> members(UUID organizationId, int limit, long offset) {
		return jdbc.sql(MEMBERS + """
				where organization_id = ?
				order by case role when 'owner' then 0 else 1 end, created_at, account_id
				limit ? offset ?
				""").params(organizationId, limit, offset).query(MembershipRepository::member).list();
	}

	public long countMembers(UUID organizationId) {
		return jdbc.sql("select count(*) from organization_member where organization_id = ?")
			.param(organizationId)
			.query(Long.class)
			.single();
	}

	public int owners(UUID organizationId) {
		return jdbc.sql("select count(*) from organization_member where organization_id = ? and role = 'owner'")
			.param(organizationId)
			.query(Integer.class)
			.single();
	}

	/** Adds the person unless they already belong somewhere; says whether it did. */
	public boolean add(UUID organizationId, UUID accountId, String role) {
		return jdbc.sql("""
				insert into organization_member (organization_id, account_id, role) values (?, ?, ?)
				on conflict (account_id) do nothing
				""").params(organizationId, accountId, role).update() == 1;
	}

	public void changeRole(UUID organizationId, UUID accountId, String role) {
		jdbc.sql("update organization_member set role = ? where organization_id = ? and account_id = ?")
			.params(role, organizationId, accountId)
			.update();
	}

	public void changeJobTitle(UUID accountId, @Nullable String jobTitle) {
		jdbc.sql("update organization_member set job_title = :jobTitle where account_id = :accountId")
			.param("jobTitle", jobTitle, Types.VARCHAR)
			.param("accountId", accountId)
			.update();
	}

	public void remove(UUID organizationId, UUID accountId) {
		jdbc.sql("delete from organization_member where organization_id = ? and account_id = ?")
			.params(organizationId, accountId)
			.update();
	}

	/**
	 * Records the invitation unless the address already holds an open one of this organization; says whether it did.
	 * A lapsed invitation of the address is closed first, so it does not hold the place of the new one.
	 * @param byOperator whether an operator sends it, which keeps it out of the organization's limits
	 * @param lifetime how long the invitation stays open
	 */
	public boolean invite(UUID id, UUID organizationId, String email, String role, UUID invitedBy, boolean byOperator,
			Duration lifetime) {
		jdbc.sql("""
				update organization_invitation set status = 'expired', decided_at = now()
				where organization_id = ? and lower(email) = lower(?) and status = 'pending' and expires_at <= now()
				""").params(organizationId, email).update();
		return jdbc.sql("""
				insert into organization_invitation
				    (id, organization_id, email, role, invited_by_account_id, sent_by_operator, expires_at)
				values (?, ?, ?, ?, ?, ?, now() + make_interval(secs => ?))
				on conflict (organization_id, lower(email)) where status = 'pending' do nothing
				""").params(id, organizationId, email, role, invitedBy, byOperator, lifetime.toSeconds()).update() == 1;
	}

	/** How many invitations the organization's owners sent in the last 24 hours, whatever became of them. */
	public int invitationsSentInTheLastDay(UUID organizationId) {
		return jdbc.sql("""
				select count(*) from organization_invitation
				where organization_id = ? and not sent_by_operator and created_at > now() - interval '24 hours'
				""").param(organizationId).query(Integer.class).single();
	}

	/** How many invitations of the organization's owners are open. */
	public int openInvitationsByOwners(UUID organizationId) {
		return jdbc.sql("""
				select count(*) from organization_invitation
				where organization_id = ? and not sent_by_operator and status = 'pending' and expires_at > now()
				""").param(organizationId).query(Integer.class).single();
	}

	public Optional<Invitation> openInvitation(UUID id) {
		return jdbc.sql(INVITATIONS + "where id = ? and status = 'pending' and expires_at > now()")
			.param(id)
			.query(MembershipRepository::invitation)
			.optional();
	}

	public List<Invitation> openInvitationsOf(UUID organizationId) {
		return jdbc.sql(INVITATIONS
				+ "where organization_id = ? and status = 'pending' and expires_at > now() order by created_at, id")
			.param(organizationId)
			.query(MembershipRepository::invitation)
			.list();
	}

	public List<Invitation> openInvitationsTo(String email) {
		return jdbc.sql(INVITATIONS
				+ "where lower(email) = lower(?) and status = 'pending' and expires_at > now() order by created_at, id")
			.param(email)
			.query(MembershipRepository::invitation)
			.list();
	}

	/** Closes an open invitation; says whether it was still open. */
	public boolean closeInvitation(UUID id, String status) {
		return jdbc.sql("""
				update organization_invitation set status = ?, decided_at = now()
				where id = ? and status = 'pending' and expires_at > now()
				""").params(status, id).update() == 1;
	}

	/**
	 * Records the request unless the person already waits on one; says whether it did.
	 * @param claim whether nobody owns the organization, so GenAI Fund decides it
	 */
	public boolean request(UUID id, UUID organizationId, UUID accountId, @Nullable String message, boolean claim) {
		return jdbc.sql("""
				insert into organization_join_request (id, organization_id, account_id, message, claim)
				values (:id, :organizationId, :accountId, :message, :claim)
				on conflict (account_id) where status = 'pending' do nothing
				""")
			.param("id", id)
			.param("organizationId", organizationId)
			.param("accountId", accountId)
			.param("message", message, Types.VARCHAR)
			.param("claim", claim)
			.update() == 1;
	}

	/** The request the person made last, when it is no longer open; empty when they never asked or still wait. */
	public Optional<ClosedRequest> latestClosedRequestOf(UUID accountId) {
		return jdbc.sql("""
				select organization_id, status, claim, decided_at
				from (select organization_id, status, claim, decided_at from organization_join_request
				      where account_id = ?
				      order by created_at desc, id
				      limit 1) latest
				where status <> 'pending'
				""")
			.param(accountId)
			.query((row, index) -> new ClosedRequest(row.getObject("organization_id", UUID.class),
					row.getString("status"), row.getBoolean("claim"), row.getTimestamp("decided_at").toInstant()))
			.optional();
	}

	/**
	 * Hands the open claims on an organization to its owners, once it has one: from then on they decide who joins.
	 */
	public void claimsBecomeRequests(UUID organizationId) {
		jdbc.sql("""
				update organization_join_request set claim = false
				where organization_id = ? and status = 'pending' and claim
				""").param(organizationId).update();
	}

	/**
	 * Moves the people of a merged organization to the one kept, each as a member who sees once where they came from.
	 */
	public void moveMembers(UUID from, UUID into) {
		jdbc.sql("""
				update organization_member set organization_id = :into, role = 'member', merged_from_id = :from
				where organization_id = :from
				""").param("from", from).param("into", into).update();
	}

	/** The organization merged into the person's own, while they have not dismissed the notice of it. */
	public Optional<UUID> mergedFromOf(UUID accountId) {
		return jdbc.sql("""
				select merged_from_id from organization_member where account_id = ? and merged_from_id is not null
				""").param(accountId)
			.query(UUID.class)
			.optional();
	}

	/** Takes the notice of a merge away from the person; nothing happens when there is none. */
	public void dismissMergeNotice(UUID accountId) {
		jdbc.sql("update organization_member set merged_from_id = null where account_id = ?").param(accountId).update();
	}

	/**
	 * Moves the open invitations of a merged organization to the one kept. An address the kept organization already
	 * invited keeps that invitation, and the merged one is revoked; a lapsed one is closed.
	 */
	public void moveOpenInvitations(UUID from, UUID into) {
		jdbc.sql("""
				update organization_invitation set status = 'expired', decided_at = now()
				where organization_id = ? and status = 'pending' and expires_at <= now()
				""").param(from).update();
		jdbc.sql("""
				update organization_invitation moved set status = 'revoked', decided_at = now()
				where moved.organization_id = :from and moved.status = 'pending'
				  and exists (select 1 from organization_invitation kept
				              where kept.organization_id = :into and kept.status = 'pending'
				                and lower(kept.email) = lower(moved.email))
				""").param("from", from).param("into", into).update();
		jdbc.sql("update organization_invitation set organization_id = ? where organization_id = ? and status = 'pending'")
			.params(into, from)
			.update();
	}

	/**
	 * Moves the open requests to a merged organization to the one kept.
	 * @param claim whether the kept organization has no owner, so GenAI Fund decides them; else its owners do
	 */
	public void moveOpenRequests(UUID from, UUID into, boolean claim) {
		jdbc.sql("""
				update organization_join_request set organization_id = :into, claim = :claim
				where organization_id = :from and status = 'pending'
				""").param("from", from).param("into", into).param("claim", claim).update();
	}

	public Optional<JoinRequest> openRequest(UUID id) {
		return jdbc.sql(REQUESTS + "where id = ? and status = 'pending'")
			.param(id)
			.query(MembershipRepository::joinRequest)
			.optional();
	}

	public Optional<JoinRequest> openRequestOf(UUID accountId) {
		return jdbc.sql(REQUESTS + "where account_id = ? and status = 'pending'")
			.param(accountId)
			.query(MembershipRepository::joinRequest)
			.optional();
	}

	public List<JoinRequest> openRequestsTo(UUID organizationId) {
		return jdbc.sql(REQUESTS + "where organization_id = ? and status = 'pending' order by created_at, id")
			.param(organizationId)
			.query(MembershipRepository::joinRequest)
			.list();
	}

	/** Closes an open request; says whether it was still open. */
	public boolean closeRequest(UUID id, String status, @Nullable UUID decidedBy) {
		return jdbc.sql("""
				update organization_join_request set status = :status, decided_by_account_id = :decidedBy,
				    decided_at = now()
				where id = :id and status = 'pending'
				""")
			.param("status", status)
			.param("decidedBy", decidedBy, Types.OTHER)
			.param("id", id)
			.update() == 1;
	}

	private static Member member(ResultSet row, int index) throws SQLException {
		return new Member(row.getObject("organization_id", UUID.class), row.getObject("account_id", UUID.class),
				row.getString("role"), row.getString("job_title"), row.getTimestamp("created_at").toInstant());
	}

	private static Invitation invitation(ResultSet row, int index) throws SQLException {
		return new Invitation(row.getObject("id", UUID.class), row.getObject("organization_id", UUID.class),
				row.getString("email"), row.getString("role"), row.getObject("invited_by_account_id", UUID.class),
				row.getTimestamp("created_at").toInstant(), row.getTimestamp("expires_at").toInstant());
	}

	private static JoinRequest joinRequest(ResultSet row, int index) throws SQLException {
		return new JoinRequest(row.getObject("id", UUID.class), row.getObject("organization_id", UUID.class),
				row.getObject("account_id", UUID.class), row.getString("message"), row.getBoolean("claim"),
				row.getTimestamp("created_at").toInstant());
	}
}
