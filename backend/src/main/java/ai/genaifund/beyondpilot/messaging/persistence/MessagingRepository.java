package ai.genaifund.beyondpilot.messaging.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Conversations, their messages and how far each reader has read. The rows change by single statements and the lists
 * are projections, so they are written here and not through entities.
 */
@Repository
public class MessagingRepository {

	public static final String TALENT = "talent";

	public static final String SOLUTION = "solution";

	public static final String PROGRAM = "program";

	public static final String PENDING = "pending";

	public static final String ACCEPTED = "accepted";

	public static final String DECLINED = "declined";

	public static final String REPORTED = "reported";

	public static final String CLOSED = "closed";

	private static final String COLUMNS = """
			c.id, c.kind, c.talent_profile_id, c.solution_id, c.program_id, c.subject_name, c.starter_account_id,
			c.starter_organization_id, c.recipient_account_id, c.recipient_organization_id, c.status, c.created_at,
			c.answered_at, c.reminded_at, c.last_message_at
			""";

	/**
	 * What a reader sees: every conversation they started, and the ones that wait or are open on the other side when
	 * they are that side. A request the other side declined, reported or let close is gone for that side.
	 */
	private static final String VISIBLE = """
			(c.starter_account_id = :me
			 or (c.status in ('pending', 'accepted')
			     and (c.recipient_account_id = :me
			          or c.recipient_organization_id = cast(:organization as uuid)
			          or (c.kind = 'program' and :operator))))
			""";

	/** A message counts as unread for a reader when the other side wrote it after what the reader has read. */
	private static final String UNREAD = """
			(select count(*) from messaging_message m
			 where m.conversation_id = c.id and m.seq > coalesce(r.read_seq, 0)
			   and (m.sender_account_id = c.starter_account_id) <> (c.starter_account_id = :me))
			""";

	private final JdbcClient jdbc;

	MessagingRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** One conversation. Exactly one of the three subjects is set, by its kind. */
	public record Conversation(UUID id, String kind, @Nullable UUID talentProfileId, @Nullable UUID solutionId,
			@Nullable UUID programId, String subjectName, UUID starterAccountId, @Nullable UUID starterOrganizationId,
			@Nullable UUID recipientAccountId, @Nullable UUID recipientOrganizationId, String status, Instant createdAt,
			@Nullable Instant answeredAt, @Nullable Instant remindedAt, Instant lastMessageAt) {

		/** The profile, solution or program the conversation is about. */
		public UUID subjectId() {
			if (talentProfileId != null) {
				return talentProfileId;
			}
			return solutionId != null ? solutionId : Objects.requireNonNull(programId);
		}
	}

	/**
	 * A conversation in a reader's list: with its last message and how many messages of the other side they have not
	 * read.
	 */
	public record Listed(Conversation conversation, @Nullable String lastBody, @Nullable UUID lastSenderAccountId,
			int unread) {
	}

	/** One message. */
	public record Message(UUID id, UUID conversationId, long seq, UUID senderAccountId, String body, Instant createdAt) {
	}

	/** A message as it was kept, and whether this call wrote it or an earlier one had. */
	public record Written(Message message, boolean created) {
	}

	/** What waits for a reader across their conversations. */
	public record Totals(int unread, int requests) {
	}

	/** A request the other side reported, with the message that was reported. */
	public record Reported(Conversation conversation, String message) {
	}

	public Optional<Conversation> find(UUID id) {
		return jdbc.sql("select " + COLUMNS + " from messaging_conversation c where c.id = ?")
			.param(id)
			.query(MessagingRepository::conversation)
			.optional();
	}

	/** The conversation, locked until the transaction ends so that two answers cannot both win. */
	public Optional<Conversation> findForUpdate(UUID id) {
		return jdbc.sql("select " + COLUMNS + " from messaging_conversation c where c.id = ? for update")
			.param(id)
			.query(MessagingRepository::conversation)
			.optional();
	}

	/** The conversation a person has with a profile, a solution or a program while it waits or is open. */
	public Optional<Conversation> active(UUID starterAccountId, String kind, UUID subjectId) {
		return jdbc.sql("select " + COLUMNS + " from messaging_conversation c where c.starter_account_id = ? and "
				+ subjectColumn(kind) + " = ? and c.status in ('pending', 'accepted')")
			.params(starterAccountId, subjectId)
			.query(MessagingRepository::conversation)
			.optional();
	}

	/**
	 * Records a conversation.
	 * @return false when the person already has one with the same subject that waits or is open
	 */
	public boolean create(UUID id, String kind, UUID subjectId, String subjectName, UUID starterAccountId,
			@Nullable UUID starterOrganizationId, @Nullable UUID recipientAccountId,
			@Nullable UUID recipientOrganizationId, String status) {
		try {
			jdbc.sql("insert into messaging_conversation (id, kind, " + subjectColumn(kind).substring(2) + """
					, subject_name, starter_account_id, starter_organization_id, recipient_account_id,
					recipient_organization_id, status, answered_at)
					values (:id, :kind, :subject, :subjectName, :starter, :starterOrganization, :recipient,
					        :recipientOrganization, :status, case when :status = 'accepted' then now() end)
					""")
				.param("id", id)
				.param("kind", kind)
				.param("subject", subjectId)
				.param("subjectName", subjectName)
				.param("starter", starterAccountId)
				.param("starterOrganization", starterOrganizationId, Types.OTHER)
				.param("recipient", recipientAccountId, Types.OTHER)
				.param("recipientOrganization", recipientOrganizationId, Types.OTHER)
				.param("status", status)
				.update();
			return true;
		}
		catch (DuplicateKeyException exception) {
			return false;
		}
	}

	/** How many conversations a person started since the moment given. */
	public long startedSince(UUID starterAccountId, Instant since) {
		return jdbc.sql("select count(*) from messaging_conversation where starter_account_id = ? and created_at >= ?")
			.params(starterAccountId, Timestamp.from(since))
			.query(Long.class)
			.single();
	}

	/** How many messages a person wrote since the moment given. */
	public long writtenSince(UUID senderAccountId, Instant since) {
		return jdbc.sql("select count(*) from messaging_message where sender_account_id = ? and created_at >= ?")
			.params(senderAccountId, Timestamp.from(since))
			.query(Long.class)
			.single();
	}

	/**
	 * The conversations a reader sees, the one written in last first.
	 * @param organizationId the organization the reader belongs to; null when none
	 * @param operator whether the reader answers for GenAI Fund
	 */
	public List<Listed> listFor(UUID accountId, @Nullable UUID organizationId, boolean operator, int limit) {
		return reader("select " + COLUMNS + ", last.body as last_body, last.sender_account_id as last_sender, " + UNREAD
				+ """
						as unread
						from messaging_conversation c
						left join messaging_read r on r.conversation_id = c.id and r.account_id = :me
						left join lateral (select m.body, m.sender_account_id from messaging_message m
						                   where m.conversation_id = c.id order by m.seq desc limit 1) last on true
						where
						""" + VISIBLE + "order by c.last_message_at desc, c.id limit :limit", accountId, organizationId,
				operator)
			.param("limit", limit)
			.query(MessagingRepository::listed)
			.list();
	}

	/** One conversation as it stands in a reader's list; the caller has checked that the reader may see it. */
	public Optional<Listed> listed(UUID id, UUID accountId) {
		return jdbc.sql("select " + COLUMNS + ", last.body as last_body, last.sender_account_id as last_sender, " + UNREAD
				+ """
						as unread
						from messaging_conversation c
						left join messaging_read r on r.conversation_id = c.id and r.account_id = :me
						left join lateral (select m.body, m.sender_account_id from messaging_message m
						                   where m.conversation_id = c.id order by m.seq desc limit 1) last on true
						where c.id = :id
						""")
			.param("me", accountId)
			.param("id", id)
			.query(MessagingRepository::listed)
			.optional();
	}

	/** The unread messages of a reader's open conversations, and the requests that wait for them. */
	public Totals totals(UUID accountId, @Nullable UUID organizationId, boolean operator) {
		return reader("select coalesce(sum(" + UNREAD + """
				) filter (where c.status = 'accepted'), 0) as unread,
				count(*) filter (where c.status = 'pending' and c.starter_account_id <> :me) as requests
				from messaging_conversation c
				left join messaging_read r on r.conversation_id = c.id and r.account_id = :me
				where c.status in ('pending', 'accepted') and
				""" + VISIBLE, accountId, organizationId, operator)
			.query((row, index) -> new Totals(row.getInt("unread"), row.getInt("requests")))
			.single();
	}

	/**
	 * Keeps a message and moves its conversation to the top of every list. A message with an identifier already kept is
	 * returned as it was kept, so sending the same message again writes nothing.
	 */
	public Written write(UUID id, UUID conversationId, UUID senderAccountId, String body) {
		int inserted = jdbc.sql("""
				insert into messaging_message (id, conversation_id, sender_account_id, body) values (?, ?, ?, ?)
				on conflict (id) do nothing
				""").params(id, conversationId, senderAccountId, body).update();
		Message message = jdbc
			.sql("select id, conversation_id, seq, sender_account_id, body, created_at from messaging_message where id = ?")
			.param(id)
			.query(MessagingRepository::message)
			.single();
		if (inserted == 1) {
			jdbc.sql("update messaging_conversation set last_message_at = ? where id = ?")
				.params(Timestamp.from(message.createdAt()), conversationId)
				.update();
		}
		return new Written(message, inserted == 1);
	}

	/**
	 * A page of a conversation's messages, the oldest first.
	 * @param before only those before this message, the latest of them; null for the latest of all
	 * @param after only those after this message, the earliest of them; it wins over {@code before}
	 */
	public List<Message> messages(UUID conversationId, @Nullable Long before, @Nullable Long after, int limit) {
		String columns = "select id, conversation_id, seq, sender_account_id, body, created_at from messaging_message ";
		if (after != null) {
			return jdbc.sql(columns + "where conversation_id = ? and seq > ? order by seq limit ?")
				.params(conversationId, after, limit)
				.query(MessagingRepository::message)
				.list();
		}
		return jdbc
			.sql("select * from (" + columns + """
					where conversation_id = :conversation and (cast(:before as bigint) is null or seq < :before)
					order by seq desc limit :limit) latest order by seq
					""")
			.param("conversation", conversationId)
			.param("before", before, Types.BIGINT)
			.param("limit", limit)
			.query(MessagingRepository::message)
			.list();
	}

	/** The message a conversation started with. */
	public Optional<Message> first(UUID conversationId) {
		return jdbc.sql("""
				select id, conversation_id, seq, sender_account_id, body, created_at from messaging_message
				where conversation_id = ? order by seq limit 1
				""").param(conversationId).query(MessagingRepository::message).optional();
	}

	/** The seq of the last message of a conversation; 0 when it has none. */
	public long lastSeq(UUID conversationId) {
		return jdbc.sql("select coalesce(max(seq), 0) from messaging_message where conversation_id = ?")
			.param(conversationId)
			.query(Long.class)
			.single();
	}

	/**
	 * Makes the requests of one account that write wait for each other until the transaction ends, so a limit
	 * counted before writing holds for requests sent at once.
	 */
	public void lockWriter(UUID accountId) {
		jdbc.sql("select 1 from pg_advisory_xact_lock(hashtext(:key))")
			.param("key", "messaging:" + accountId)
			.query(Integer.class)
			.single();
	}

	/**
	 * Records how far a reader has read, never backwards, and that they may be emailed again about what comes next.
	 * @return how far they have read after the call
	 */
	public long markRead(UUID conversationId, UUID accountId, long seq) {
		return jdbc.sql("""
				insert into messaging_read (conversation_id, account_id, read_seq) values (:conversation, :account, :seq)
				on conflict (conversation_id, account_id)
				do update set read_seq = greatest(messaging_read.read_seq, excluded.read_seq), notified_at = null
				returning read_seq
				""")
			.param("conversation", conversationId)
			.param("account", accountId)
			.param("seq", seq)
			.query(Long.class)
			.single();
	}

	/**
	 * How far the other side has read: the person who started, or whoever read furthest among the people they wrote
	 * to.
	 * @param starterSide whether the caller is the person who started the conversation
	 */
	public long readByOtherSide(UUID conversationId, UUID starterAccountId, boolean starterSide) {
		return jdbc
			.sql("select coalesce(max(read_seq), 0) from messaging_read where conversation_id = ? and (account_id = ?) <> ?")
			.params(conversationId, starterAccountId, starterSide)
			.query(Long.class)
			.single();
	}

	/**
	 * Records that a reader is emailed about messages they have not read.
	 * @return false when they were emailed already since they last read
	 */
	public boolean markNotified(UUID conversationId, UUID accountId) {
		return jdbc.sql("""
				insert into messaging_read (conversation_id, account_id, notified_at) values (?, ?, now())
				on conflict (conversation_id, account_id)
				do update set notified_at = now() where messaging_read.notified_at is null
				""").params(conversationId, accountId).update() == 1;
	}

	/** Records the answer to a request, or that it closed. */
	public void answer(UUID id, String status, @Nullable UUID answeredBy) {
		jdbc.sql("update messaging_conversation set status = :status, answered_at = now(), answered_by_account_id = :by where id = :id")
			.param("status", status)
			.param("by", answeredBy, Types.OTHER)
			.param("id", id)
			.update();
	}

	public void markReminded(UUID id) {
		jdbc.sql("update messaging_conversation set reminded_at = now() where id = ?").param(id).update();
	}

	/** The requests that have waited since before the moment given, the oldest first. */
	public List<Conversation> waitingBefore(Instant moment, int limit) {
		return jdbc
			.sql("select " + COLUMNS + """
					from messaging_conversation c where c.status = 'pending' and c.created_at < ?
					order by c.created_at limit ?
					""")
			.params(Timestamp.from(moment), limit)
			.query(MessagingRepository::conversation)
			.list();
	}

	/** The requests that have waited since before the moment given and whose other side was not reminded yet. */
	public List<Conversation> unremindedBefore(Instant moment, int limit) {
		return jdbc
			.sql("select " + COLUMNS + """
					from messaging_conversation c
					where c.status = 'pending' and c.reminded_at is null and c.created_at < ?
					order by c.created_at limit ?
					""")
			.params(Timestamp.from(moment), limit)
			.query(MessagingRepository::conversation)
			.list();
	}

	/** Gives the conversations to and from a merged organization to the one kept. */
	public void moveToOrganization(UUID from, UUID into) {
		jdbc.sql("update messaging_conversation set recipient_organization_id = ? where recipient_organization_id = ?")
			.params(into, from)
			.update();
		jdbc.sql("update messaging_conversation set starter_organization_id = ? where starter_organization_id = ?")
			.params(into, from)
			.update();
	}

	/** One page of the reported requests, the most recently reported first. */
	public List<Reported> reportedPage(int limit, long offset) {
		return jdbc.sql("select " + COLUMNS + """
				, first.body as first_body
				from messaging_conversation c
				join lateral (select m.body from messaging_message m where m.conversation_id = c.id
				              order by m.seq limit 1) first on true
				where c.status = 'reported'
				order by c.answered_at desc, c.id limit ? offset ?
				""")
			.params(limit, offset)
			.query((row, index) -> new Reported(conversation(row, index), row.getString("first_body")))
			.list();
	}

	public long reportedCount() {
		return jdbc.sql("select count(*) from messaging_conversation where status = 'reported'").query(Long.class).single();
	}

	private JdbcClient.StatementSpec reader(String sql, UUID accountId, @Nullable UUID organizationId, boolean operator) {
		return jdbc.sql(sql)
			.param("me", accountId)
			.param("organization", organizationId, Types.OTHER)
			.param("operator", operator);
	}

	private static String subjectColumn(String kind) {
		return switch (kind) {
			case TALENT -> "c.talent_profile_id";
			case SOLUTION -> "c.solution_id";
			case PROGRAM -> "c.program_id";
			default -> throw new IllegalArgumentException("Unknown kind of conversation: " + kind);
		};
	}

	private static Listed listed(ResultSet row, int index) throws SQLException {
		return new Listed(conversation(row, index), row.getString("last_body"),
				row.getObject("last_sender", UUID.class), row.getInt("unread"));
	}

	private static Conversation conversation(ResultSet row, int index) throws SQLException {
		return new Conversation(row.getObject("id", UUID.class), row.getString("kind"),
				row.getObject("talent_profile_id", UUID.class), row.getObject("solution_id", UUID.class),
				row.getObject("program_id", UUID.class), row.getString("subject_name"),
				row.getObject("starter_account_id", UUID.class), row.getObject("starter_organization_id", UUID.class),
				row.getObject("recipient_account_id", UUID.class),
				row.getObject("recipient_organization_id", UUID.class), row.getString("status"),
				row.getTimestamp("created_at").toInstant(), instant(row.getTimestamp("answered_at")),
				instant(row.getTimestamp("reminded_at")), row.getTimestamp("last_message_at").toInstant());
	}

	private static Message message(ResultSet row, int index) throws SQLException {
		return new Message(row.getObject("id", UUID.class), row.getObject("conversation_id", UUID.class),
				row.getLong("seq"), row.getObject("sender_account_id", UUID.class), row.getString("body"),
				row.getTimestamp("created_at").toInstant());
	}

	private static @Nullable Instant instant(@Nullable Timestamp value) {
		return value == null ? null : value.toInstant();
	}
}
