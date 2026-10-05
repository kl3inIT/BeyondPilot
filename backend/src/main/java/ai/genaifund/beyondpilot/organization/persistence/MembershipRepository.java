package ai.genaifund.beyondpilot.organization.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
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
			select id, organization_id, email, role, invited_by_account_id, created_at from organization_invitation
			""";

	private static final String REQUESTS = """
			select id, organization_id, account_id, message, created_at from organization_join_request
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

	/** One open invitation. */
	public record Invitation(UUID id, UUID organizationId, String email, String role, UUID invitedByAccountId,
			Instant createdAt) {
	}

	/** One open request to join. */
	public record JoinRequest(UUID id, UUID organizationId, UUID accountId, @Nullable String message,
			Instant createdAt) {
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

	/** Records the invitation unless the address already holds an open one of this organization; says whether it did. */
	public boolean invite(UUID id, UUID organizationId, String email, String role, UUID invitedBy) {
		return jdbc.sql("""
				insert into organization_invitation (id, organization_id, email, role, invited_by_account_id)
				values (?, ?, ?, ?, ?)
				on conflict (organization_id, lower(email)) where status = 'pending' do nothing
				""").params(id, organizationId, email, role, invitedBy).update() == 1;
	}

	public Optional<Invitation> openInvitation(UUID id) {
		return jdbc.sql(INVITATIONS + "where id = ? and status = 'pending'")
			.param(id)
			.query(MembershipRepository::invitation)
			.optional();
	}

	public List<Invitation> openInvitationsOf(UUID organizationId) {
		return jdbc.sql(INVITATIONS + "where organization_id = ? and status = 'pending' order by created_at, id")
			.param(organizationId)
			.query(MembershipRepository::invitation)
			.list();
	}

	public List<Invitation> openInvitationsTo(String email) {
		return jdbc.sql(INVITATIONS + "where lower(email) = lower(?) and status = 'pending' order by created_at, id")
			.param(email)
			.query(MembershipRepository::invitation)
			.list();
	}

	/** Closes an open invitation; says whether it was still open. */
	public boolean closeInvitation(UUID id, String status) {
		return jdbc.sql("""
				update organization_invitation set status = ?, decided_at = now() where id = ? and status = 'pending'
				""").params(status, id).update() == 1;
	}

	/** Records the request unless the person already waits on one; says whether it did. */
	public boolean request(UUID id, UUID organizationId, UUID accountId, @Nullable String message) {
		return jdbc.sql("""
				insert into organization_join_request (id, organization_id, account_id, message)
				values (:id, :organizationId, :accountId, :message)
				on conflict (account_id) where status = 'pending' do nothing
				""")
			.param("id", id)
			.param("organizationId", organizationId)
			.param("accountId", accountId)
			.param("message", message, Types.VARCHAR)
			.update() == 1;
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
				row.getTimestamp("created_at").toInstant());
	}

	private static JoinRequest joinRequest(ResultSet row, int index) throws SQLException {
		return new JoinRequest(row.getObject("id", UUID.class), row.getObject("organization_id", UUID.class),
				row.getObject("account_id", UUID.class), row.getString("message"),
				row.getTimestamp("created_at").toInstant());
	}
}
