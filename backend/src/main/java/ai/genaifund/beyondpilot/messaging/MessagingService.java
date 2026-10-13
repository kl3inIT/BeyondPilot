package ai.genaifund.beyondpilot.messaging;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.messaging.MessagingChanges.Audience;
import ai.genaifund.beyondpilot.messaging.MessagingChanges.Listener;
import ai.genaifund.beyondpilot.messaging.Subjects.Target;
import ai.genaifund.beyondpilot.messaging.dto.ConversationDetailResponse;
import ai.genaifund.beyondpilot.messaging.dto.ConversationListResponse;
import ai.genaifund.beyondpilot.messaging.dto.ConversationResponse;
import ai.genaifund.beyondpilot.messaging.dto.LastMessageResponse;
import ai.genaifund.beyondpilot.messaging.dto.MarkReadRequest;
import ai.genaifund.beyondpilot.messaging.dto.MessageListRequest;
import ai.genaifund.beyondpilot.messaging.dto.MessagePageResponse;
import ai.genaifund.beyondpilot.messaging.dto.MessageResponse;
import ai.genaifund.beyondpilot.messaging.dto.MessagingEvent;
import ai.genaifund.beyondpilot.messaging.dto.MessagingEvent.Kind;
import ai.genaifund.beyondpilot.messaging.dto.ParticipantResponse;
import ai.genaifund.beyondpilot.messaging.dto.ProspectRequest;
import ai.genaifund.beyondpilot.messaging.dto.ProspectResponse;
import ai.genaifund.beyondpilot.messaging.dto.SendMessageRequest;
import ai.genaifund.beyondpilot.messaging.dto.StartConversationRequest;
import ai.genaifund.beyondpilot.messaging.dto.UnreadResponse;
import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository;
import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository.Conversation;
import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository.Listed;
import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository.Message;
import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository.Written;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;

/**
 * What people do in their conversations: write a first message to the person behind a talent profile, to the
 * organization that offers a solution or to GenAI Fund about a program, answer one that was written to them, write
 * and read, and hear what happens while a screen is open.
 *
 * <p>
 * A conversation has two sides. The person who wrote first is one; the other is the person behind the profile, every
 * member of the organization that offers the solution, or GenAI Fund's operators. A first message to a person or an
 * organization waits as a request: the other side accepts, declines or reports it, and only an accepted conversation
 * is written in. GenAI Fund's conversations are open at once. Neither side is shown the other's email address.
 */
@Service
public class MessagingService {

	private static final Logger LOG = LoggerFactory.getLogger(MessagingService.class);

	/** How long a request waits for its answer before it closes. */
	static final Duration REQUEST_LIFETIME = Duration.ofDays(14);

	/** How many conversations a person starts in a day. */
	static final int STARTS_A_DAY = 10;

	/** How many messages a person writes in a minute. */
	static final int MESSAGES_A_MINUTE = 30;

	/** How many messages a page of a conversation holds. */
	static final int PAGE = 50;

	/** How many conversations a list holds. */
	private static final int LISTED = 200;

	private static final int PREVIEW = 140;

	/**
	 * How long a stream of events stays open. The screen opens it again by itself, so that what a person may hear is
	 * decided again from who they are now: someone who left an organization stops hearing its conversations.
	 */
	public static final Duration STREAM_LIFETIME = Duration.ofMinutes(10);

	private static final String CONVERSATION = "conversation";

	private final MessagingRepository conversations;

	private final MessagingChanges changes;

	private final Subjects subjects;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final EmailService email;

	private final AuditTrail audit;

	MessagingService(MessagingRepository conversations, MessagingChanges changes, Subjects subjects,
			OrganizationDirectory organizations, IdentityService identity, EmailService email, AuditTrail audit) {
		this.conversations = conversations;
		this.changes = changes;
		this.subjects = subjects;
		this.organizations = organizations;
		this.identity = identity;
		this.email = email;
		this.audit = audit;
	}

	/** Which side of a conversation a person is on. */
	private enum Side {

		STARTER, RECIPIENT

	}

	/**
	 * Who asks, read now.
	 * @param membership the organization they belong to; null when none
	 * @param operator whether they answer for GenAI Fund
	 */
	private record Caller(UUID accountId, @Nullable Membership membership, boolean operator) {

		@Nullable UUID organizationId() {
			return membership == null ? null : membership.organizationId();
		}
	}

	/** The names a list of conversations is shown with, read once for all of them. */
	private record Names(Map<UUID, Person> people, Map<UUID, OrganizationName> organizations) {

		@Nullable String person(@Nullable UUID accountId) {
			Person person = accountId == null ? null : people.get(accountId);
			return person == null ? null : person.displayName();
		}

		@Nullable String organization(@Nullable UUID organizationId) {
			OrganizationName organization = organizationId == null ? null : organizations.get(organizationId);
			return organization == null ? null : organization.name();
		}
	}

	/** The caller's conversations in the two lists the screen shows, the one written in last first. */
	@Transactional(readOnly = true)
	public ConversationListResponse list(Actor actor) {
		Caller caller = caller(actor);
		List<Listed> rows = conversations.listFor(caller.accountId(), caller.organizationId(), caller.operator(), LISTED);
		Names names = names(rows);
		List<ConversationResponse> chats = new ArrayList<>();
		List<ConversationResponse> requests = new ArrayList<>();
		for (Listed row : rows) {
			Side side = side(caller, row.conversation());
			if (side == null) {
				continue;
			}
			ConversationResponse response = response(caller, side, row, names);
			boolean waitsForCaller = side == Side.RECIPIENT
					&& MessagingRepository.PENDING.equals(row.conversation().status());
			(waitsForCaller ? requests : chats).add(response);
		}
		return new ConversationListResponse(chats, requests,
				chats.stream().mapToInt(ConversationResponse::unread).sum());
	}

	/** How many messages the caller has not read, and how many first messages wait for their side. */
	@Transactional(readOnly = true)
	public UnreadResponse unread(Actor actor) {
		Caller caller = caller(actor);
		MessagingRepository.Totals totals = conversations.totals(caller.accountId(), caller.organizationId(),
				caller.operator());
		return new UnreadResponse(totals.unread(), totals.requests());
	}

	/**
	 * Who the caller would write to at a public address, before anything is written: what it is about, who reads it,
	 * and the conversation they already have there.
	 * @throws MessagingException when nothing is at the address, it is the caller's own, or the caller may not write
	 * to it
	 */
	@Transactional(readOnly = true)
	public ProspectResponse prospect(Actor actor, ProspectRequest request) {
		Caller caller = caller(actor);
		Target target = target(caller, request.kind(), request.slug());
		return new ProspectResponse(
				conversations.active(caller.accountId(), target.kind(), target.subjectId())
					.map(Conversation::id)
					.orElse(null),
				counterpartName(target.kind(), target.subjectName(), organizationName(target.recipientOrganizationId())),
				!MessagingRepository.PROGRAM.equals(target.kind()),
				subjects.describe(target.kind(), target.subjectId(), target.subjectName()),
				recipients(target.kind(), target.subjectName(), target.recipientOrganizationId()));
	}

	/**
	 * Writes a first message. To a person or an organization it waits as a request, of which they are told by email
	 * without the sender's address; to GenAI Fund the conversation is open at once. A person who already talks with the
	 * other side writes in that conversation instead.
	 * @throws MessagingException when nothing is at the address, it is the caller's own, the caller may not write to
	 * it, their earlier first message still waits, or they started as many conversations as a day allows
	 */
	@Transactional
	public ConversationDetailResponse start(Actor actor, StartConversationRequest request) {
		Caller caller = caller(actor);
		Person person = identity.person(actor);
		Target target = target(caller, request.kind(), request.slug());
		String body = request.body().strip();
		// One writer at a time for an account, so the limits count what its other requests are writing.
		conversations.lockWriter(caller.accountId());
		Conversation open = conversations.active(caller.accountId(), target.kind(), target.subjectId()).orElse(null);
		if (open != null) {
			if (!MessagingRepository.ACCEPTED.equals(open.status())) {
				throw new MessagingException(MessagingErrorCode.ALREADY_WAITING,
						"A second first message in the waiting conversation " + open.id());
			}
			write(caller, person, open, UUID.randomUUID(), body);
			return detail(caller, open);
		}
		Instant now = Instant.now();
		if (conversations.startedSince(caller.accountId(), now.minus(1, ChronoUnit.DAYS)) >= STARTS_A_DAY) {
			throw new MessagingException(MessagingErrorCode.TOO_MANY_REQUESTS,
					"More than " + STARTS_A_DAY + " conversations in a day by account " + caller.accountId(),
					Duration.ofHours(1));
		}
		boolean waits = !MessagingRepository.PROGRAM.equals(target.kind());
		UUID id = UUID.randomUUID();
		Membership membership = caller.membership();
		UUID starterOrganizationId = membership != null && membership.approved() ? membership.organizationId() : null;
		if (!conversations.create(id, target.kind(), target.subjectId(), target.subjectName(), caller.accountId(),
				starterOrganizationId, target.recipientAccountId(), target.recipientOrganizationId(),
				waits ? MessagingRepository.PENDING : MessagingRepository.ACCEPTED)) {
			throw new MessagingException(MessagingErrorCode.ALREADY_WAITING,
					"A second conversation about " + target.kind() + " " + target.subjectId());
		}
		Conversation conversation = conversations.find(id).orElseThrow();
		Message first = conversations.write(UUID.randomUUID(), id, caller.accountId(), body).message();
		conversations.markRead(id, caller.accountId(), first.seq());
		if (waits) {
			String organizationName = starterOrganizationId == null ? null
					: Objects.requireNonNull(membership).organizationName();
			for (Person recipient : answering(conversation)) {
				email.sendMessageRequest(recipient.email(), person.displayName(), organizationName,
						target.subjectName(), body);
			}
		}
		changes.tell(audience(conversation), listener -> event(Kind.CONVERSATION, id));
		LOG.atInfo()
			.addKeyValue("event", "messaging.conversation.started")
			.addKeyValue("conversation_id", id)
			.addKeyValue("conversation_kind", target.kind())
			.log("Conversation started");
		return detail(caller, conversation);
	}

	/**
	 * One conversation with its latest messages, what it is about and who is on the other side.
	 * @throws MessagingException when the caller has no such conversation; another person's answers the same as none
	 */
	@Transactional(readOnly = true)
	public ConversationDetailResponse get(Actor actor, UUID id) {
		Caller caller = caller(actor);
		return detail(caller, visible(caller, id));
	}

	/**
	 * Some messages of a conversation, the oldest first: those before a message, to read further back, or those after
	 * one, to catch up with what was written while the screen was away.
	 * @throws MessagingException when the caller has no such conversation
	 */
	@Transactional(readOnly = true)
	public MessagePageResponse messages(Actor actor, UUID id, MessageListRequest request) {
		Caller caller = caller(actor);
		Conversation conversation = visible(caller, id);
		Side side = Objects.requireNonNull(side(caller, conversation));
		List<Message> found = conversations.messages(id, request.before(), request.after(), PAGE + 1);
		boolean more = found.size() > PAGE;
		List<Message> page = !more ? found
				: request.after() != null ? found.subList(0, PAGE) : found.subList(1, found.size());
		return new MessagePageResponse(responses(caller, conversation, page), more,
				conversations.readByOtherSide(id, conversation.starterAccountId(), side == Side.STARTER));
	}

	/**
	 * Writes a message in an open conversation. Everyone of the conversation with a screen open hears it at once; the
	 * people of the other side who have none are emailed, once until they read, that a message waits.
	 * @throws MessagingException when the caller has no such conversation, it is not open, the identifier belongs to
	 * another message, or the caller writes too fast
	 */
	@Transactional
	public MessageResponse send(Actor actor, UUID id, SendMessageRequest request) {
		Caller caller = caller(actor);
		Person person = identity.person(actor);
		Conversation conversation = visible(caller, id);
		if (!MessagingRepository.ACCEPTED.equals(conversation.status())) {
			throw new MessagingException(MessagingErrorCode.NOT_OPEN,
					"A message in conversation " + id + ", which is " + conversation.status());
		}
		Message message = write(caller, person, conversation, request.id(), request.body().strip());
		return response(caller, conversation, message, person.displayName());
	}

	/**
	 * Records how far the caller has read a conversation, and tells the other side. Nothing is recorded or told for
	 * a conversation that is not open: the sender of a first message is not told that it was read until it is
	 * accepted. A reader is never recorded past the last message of the conversation.
	 * @throws MessagingException when the caller has no such conversation
	 */
	@Transactional
	public void read(Actor actor, UUID id, MarkReadRequest request) {
		Caller caller = caller(actor);
		Conversation conversation = visible(caller, id);
		long last = conversations.lastSeq(id);
		if (!MessagingRepository.ACCEPTED.equals(conversation.status()) || last == 0) {
			return;
		}
		long seq = conversations.markRead(id, caller.accountId(), Math.min(request.seq(), last));
		boolean fromStarter = side(caller, conversation) == Side.STARTER;
		changes.tell(audience(conversation), listener -> new MessagingEvent(Kind.READ, id, null, seq, fromStarter,
				listener.accountId().equals(caller.accountId()), null));
	}

	/**
	 * Tells the others of an open conversation that the caller is writing. Nothing is kept.
	 * @throws MessagingException when the caller has no such conversation
	 */
	@Transactional(readOnly = true)
	public void typing(Actor actor, UUID id) {
		Caller caller = caller(actor);
		Conversation conversation = visible(caller, id);
		if (!MessagingRepository.ACCEPTED.equals(conversation.status())) {
			return;
		}
		String name = identity.person(actor).displayName();
		boolean fromStarter = side(caller, conversation) == Side.STARTER;
		changes.tell(audience(conversation), listener -> listener.accountId().equals(caller.accountId()) ? null
				: new MessagingEvent(Kind.TYPING, id, null, null, fromStarter, null, name));
	}

	/**
	 * Accepts a first message: the conversation opens and the sender is told.
	 * @throws MessagingException when no such request waits for the caller's side, it was answered already, or the
	 * caller is a member of the organization written to and not an owner
	 */
	@Transactional
	public ConversationDetailResponse accept(Actor actor, UUID id) {
		answer(actor, id, MessagingRepository.ACCEPTED, AuditAction.MESSAGING_REQUEST_ACCEPT);
		return get(actor, id);
	}

	/**
	 * Declines a first message. The sender is told that it will not be taken further, without a reason.
	 * @throws MessagingException as {@link #accept(Actor, UUID)}
	 */
	@Transactional
	public void decline(Actor actor, UUID id) {
		answer(actor, id, MessagingRepository.DECLINED, AuditAction.MESSAGING_REQUEST_DECLINE);
	}

	/**
	 * Reports a first message as unwanted. The sender is told what a decline tells, so the person who reported is not
	 * exposed; operators read what was reported.
	 * @throws MessagingException as {@link #accept(Actor, UUID)}
	 */
	@Transactional
	public void report(Actor actor, UUID id) {
		answer(actor, id, MessagingRepository.REPORTED, AuditAction.MESSAGING_REQUEST_REPORT);
	}

	/**
	 * What happens in the caller's conversations from now on. Nothing is replayed: a screen reads what it missed
	 * whenever its stream opens. Whoever carries the stream ends it after {@link #STREAM_LIFETIME}.
	 */
	@Transactional(readOnly = true)
	public Flux<MessagingEvent> events(Actor actor) {
		Caller caller = caller(actor);
		return changes.of(new Listener(caller.accountId(), caller.organizationId(), caller.operator()));
	}

	private void answer(Actor actor, UUID id, String status, AuditAction action) {
		Caller caller = caller(actor);
		Person person = identity.person(actor);
		Conversation conversation = conversations.findForUpdate(id)
			.filter(found -> side(caller, found) == Side.RECIPIENT)
			.orElseThrow(() -> notFound(id));
		if (!MessagingRepository.PENDING.equals(conversation.status())) {
			throw new MessagingException(MessagingErrorCode.NOT_WAITING, "Conversation " + id + " was answered already");
		}
		if (!mayAnswer(caller, conversation)) {
			throw new MessagingException(MessagingErrorCode.OWNERS_ONLY,
					"A first message answered by a member who is not an owner");
		}
		conversations.answer(id, status, caller.accountId());
		if (MessagingRepository.ACCEPTED.equals(status)) {
			// Whoever accepts has read what they accept.
			conversations.first(id).ifPresent(first -> conversations.markRead(id, caller.accountId(), first.seq()));
		}
		Person starter = identity.people(List.of(conversation.starterAccountId())).get(conversation.starterAccountId());
		if (starter != null) {
			String answeredBy = starterReads(conversation);
			if (MessagingRepository.ACCEPTED.equals(status)) {
				email.sendMessageRequestAccepted(starter.email(), answeredBy);
			}
			else {
				email.sendMessageRequestDeclined(starter.email(), answeredBy);
			}
		}
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(caller.accountId(), person.label(), person.email()),
				new AuditRecord.Resource(CONVERSATION, id.toString(), conversation.subjectName()), Map.of()));
		changes.tell(audience(conversation), listener -> event(Kind.CONVERSATION, id));
	}

	/** Keeps a message, tells the screens that are open, and emails the people of the other side who have none. */
	private Message write(Caller caller, Person person, Conversation conversation, UUID messageId, String body) {
		// One writer at a time for an account, so the limit counts what its other requests are writing.
		conversations.lockWriter(caller.accountId());
		if (conversations.writtenSince(caller.accountId(), Instant.now().minus(1, ChronoUnit.MINUTES)) >= MESSAGES_A_MINUTE) {
			throw new MessagingException(MessagingErrorCode.TOO_MANY_MESSAGES,
					"More than " + MESSAGES_A_MINUTE + " messages in a minute by account " + caller.accountId(),
					Duration.ofSeconds(30));
		}
		Written written = conversations.write(messageId, conversation.id(), caller.accountId(), body);
		Message message = written.message();
		if (!message.conversationId().equals(conversation.id())
				|| !message.senderAccountId().equals(caller.accountId())) {
			throw new MessagingException(MessagingErrorCode.MESSAGE_CONFLICT,
					"The identifier " + messageId + " belongs to another message");
		}
		if (!written.created()) {
			return message;
		}
		conversations.markRead(conversation.id(), caller.accountId(), message.seq());
		boolean fromStarter = message.senderAccountId().equals(conversation.starterAccountId());
		String senderName = person.displayName();
		changes.tell(audience(conversation),
				listener -> new MessagingEvent(Kind.MESSAGE, conversation.id(),
						new MessageResponse(message.id(), message.seq(), message.body(), message.createdAt(),
								listener.accountId().equals(caller.accountId()), fromStarter, senderName),
						null, null, null, null));
		tellAbsent(conversation, caller, fromStarter, senderName);
		return message;
	}

	/**
	 * Emails the people of the other side who have no screen open that a message waits, once until they read. GenAI
	 * Fund's operators are not emailed: they read Messages as part of their work.
	 */
	private void tellAbsent(Conversation conversation, Caller sender, boolean fromStarter, @Nullable String senderName) {
		List<UUID> others = fromStarter ? recipientAccounts(conversation) : List.of(conversation.starterAccountId());
		List<UUID> absent = others.stream()
			.filter(account -> !account.equals(sender.accountId()) && !changes.isListening(account))
			.filter(account -> conversations.markNotified(conversation.id(), account))
			.toList();
		if (absent.isEmpty()) {
			return;
		}
		// The person who started reads the other side by its name; the other side reads the person who wrote.
		String from = fromStarter ? senderName : starterReads(conversation);
		for (Person reader : identity.people(absent).values()) {
			email.sendUnreadMessages(reader.email(), from);
		}
	}

	private ConversationDetailResponse detail(Caller caller, Conversation conversation) {
		Side side = Objects.requireNonNull(side(caller, conversation));
		Listed listed = conversations.listed(conversation.id(), caller.accountId()).orElseThrow();
		List<Message> latest = conversations.messages(conversation.id(), null, null, PAGE + 1);
		boolean earlier = latest.size() > PAGE;
		List<Message> page = earlier ? latest.subList(1, latest.size()) : latest;
		Names names = names(List.of(listed));
		List<ParticipantResponse> participants = side == Side.STARTER
				? recipients(conversation.kind(), conversation.subjectName(), conversation.recipientOrganizationId())
				: List.of(new ParticipantResponse(names.person(conversation.starterAccountId()),
						names.organization(conversation.starterOrganizationId()), "person"));
		return new ConversationDetailResponse(response(caller, side, listed, names),
				responses(caller, conversation, page), earlier,
				conversations.readByOtherSide(conversation.id(), conversation.starterAccountId(), side == Side.STARTER),
				subjects.describe(conversation.kind(), conversation.subjectId(), conversation.subjectName()),
				participants);
	}

	private ConversationResponse response(Caller caller, Side side, Listed row, Names names) {
		Conversation conversation = row.conversation();
		boolean pending = MessagingRepository.PENDING.equals(conversation.status());
		boolean accepted = MessagingRepository.ACCEPTED.equals(conversation.status());
		LastMessageResponse last = row.lastBody() == null ? null
				: new LastMessageResponse(preview(row.lastBody()), caller.accountId().equals(row.lastSenderAccountId()),
						names.person(row.lastSenderAccountId()));
		return new ConversationResponse(conversation.id(), conversation.kind(),
				// A report reads as a decline, so the person who reported is not exposed.
				MessagingRepository.REPORTED.equals(conversation.status()) ? MessagingRepository.DECLINED
						: conversation.status(),
				side == Side.STARTER ? "starter" : "recipient",
				side == Side.STARTER
						? counterpartName(conversation.kind(), conversation.subjectName(),
								names.organization(conversation.recipientOrganizationId()))
						: names.person(conversation.starterAccountId()),
				side == Side.STARTER ? null : names.organization(conversation.starterOrganizationId()),
				conversation.subjectName(), last, conversation.lastMessageAt(), accepted ? row.unread() : 0,
				side == Side.RECIPIENT && pending && mayAnswer(caller, conversation), accepted,
				pending ? conversation.createdAt().plus(REQUEST_LIFETIME) : null, conversation.createdAt());
	}

	private List<MessageResponse> responses(Caller caller, Conversation conversation, List<Message> messages) {
		Map<UUID, Person> writers = identity
			.people(messages.stream().map(Message::senderAccountId).distinct().toList());
		return messages.stream().map(message -> {
			Person writer = writers.get(message.senderAccountId());
			return response(caller, conversation, message, writer == null ? null : writer.displayName());
		}).toList();
	}

	private static MessageResponse response(Caller caller, Conversation conversation, Message message,
			@Nullable String senderName) {
		return new MessageResponse(message.id(), message.seq(), message.body(), message.createdAt(),
				message.senderAccountId().equals(caller.accountId()),
				message.senderAccountId().equals(conversation.starterAccountId()), senderName);
	}

	private Caller caller(Actor actor) {
		identity.requireActive(actor);
		return new Caller(actor.accountId(), organizations.membershipOf(actor).orElse(null), identity.isOperator(actor));
	}

	/**
	 * Where a first message of the caller would go, after checking that they may write there.
	 * @throws MessagingException when nothing is at the address, it is the caller's own, or the caller may not write
	 * to it
	 */
	private Target target(Caller caller, String kind, String slug) {
		Target target = subjects.at(kind, slug)
			.orElseThrow(() -> new MessagingException(MessagingErrorCode.SUBJECT_NOT_FOUND,
					"No " + kind + " to write to at " + slug));
		boolean own = switch (kind) {
			case MessagingRepository.TALENT -> caller.accountId().equals(target.recipientAccountId());
			case MessagingRepository.SOLUTION -> {
				// The provider reads which organization asks.
				Membership membership = caller.membership();
				if (membership == null) {
					throw new MessagingException(MessagingErrorCode.NEEDS_ORGANIZATION,
							"A solution provider written to by a person without an organization");
				}
				if (!membership.approved()) {
					throw new MessagingException(MessagingErrorCode.ORGANIZATION_NOT_APPROVED,
							"A solution provider written to by the unapproved organization " + membership.organizationId());
				}
				yield membership.organizationId().equals(target.recipientOrganizationId());
			}
			default -> caller.operator();
		};
		if (own) {
			throw new MessagingException(MessagingErrorCode.OWN_SUBJECT,
					"A conversation of account " + caller.accountId() + " with their own side of " + kind + " " + slug);
		}
		return target;
	}

	/** The conversation, when the caller is on one of its sides and it is not gone for that side. */
	private Conversation visible(Caller caller, UUID id) {
		return conversations.find(id).filter(found -> side(caller, found) != null).orElseThrow(() -> notFound(id));
	}

	/**
	 * The side the caller is on; null when they are on neither, or on the side written to of a request that side
	 * declined, reported or let close.
	 */
	private static @Nullable Side side(Caller caller, Conversation conversation) {
		if (conversation.starterAccountId().equals(caller.accountId())) {
			return Side.STARTER;
		}
		boolean recipient = switch (conversation.kind()) {
			case MessagingRepository.TALENT -> caller.accountId().equals(conversation.recipientAccountId());
			case MessagingRepository.SOLUTION ->
				conversation.recipientOrganizationId() != null
						&& conversation.recipientOrganizationId().equals(caller.organizationId());
			default -> caller.operator();
		};
		boolean alive = MessagingRepository.PENDING.equals(conversation.status())
				|| MessagingRepository.ACCEPTED.equals(conversation.status());
		return recipient && alive ? Side.RECIPIENT : null;
	}

	/** The person behind a profile answers for themselves; for an organization its owners answer, as they decide for it. */
	private static boolean mayAnswer(Caller caller, Conversation conversation) {
		Membership membership = caller.membership();
		return MessagingRepository.TALENT.equals(conversation.kind()) || (membership != null && membership.owner());
	}

	/** Everyone who hears what happens in a conversation. */
	static Audience audience(Conversation conversation) {
		Set<UUID> accounts = new HashSet<>();
		accounts.add(conversation.starterAccountId());
		if (conversation.recipientAccountId() != null) {
			accounts.add(conversation.recipientAccountId());
		}
		return new Audience(accounts, conversation.recipientOrganizationId(),
				MessagingRepository.PROGRAM.equals(conversation.kind()));
	}

	/** The accounts of the side written to, GenAI Fund's operators left out. */
	private List<UUID> recipientAccounts(Conversation conversation) {
		if (conversation.recipientAccountId() != null) {
			return List.of(conversation.recipientAccountId());
		}
		return conversation.recipientOrganizationId() == null ? List.of()
				: organizations.memberAccountIds(conversation.recipientOrganizationId());
	}

	/** The people who answer a request: the person behind the profile, or the owners of the organization. */
	List<Person> answering(Conversation conversation) {
		Collection<UUID> accounts = conversation.recipientAccountId() != null
				? List.of(conversation.recipientAccountId())
				: conversation.recipientOrganizationId() == null ? List.of()
						: organizations.ownersOf(conversation.recipientOrganizationId());
		return List.copyOf(identity.people(accounts).values());
	}

	/** Who reads on the side written to, as the person who writes is shown them. */
	private List<ParticipantResponse> recipients(String kind, String subjectName, @Nullable UUID organizationId) {
		if (MessagingRepository.TALENT.equals(kind)) {
			return List.of(new ParticipantResponse(subjectName, null, "person"));
		}
		if (organizationId == null) {
			return List.of();
		}
		String organizationName = organizationName(organizationId);
		Set<UUID> owners = Set.copyOf(organizations.ownersOf(organizationId));
		return identity.people(organizations.memberAccountIds(organizationId))
			.values()
			.stream()
			.map(member -> new ParticipantResponse(member.displayName(), organizationName,
					owners.contains(member.accountId()) ? "owner" : "member"))
			.toList();
	}

	/** The other side of a conversation by the name the person who started it reads; null for GenAI Fund. */
	@Nullable String starterReads(Conversation conversation) {
		return counterpartName(conversation.kind(), conversation.subjectName(),
				organizationName(conversation.recipientOrganizationId()));
	}

	private @Nullable String organizationName(@Nullable UUID organizationId) {
		if (organizationId == null) {
			return null;
		}
		OrganizationName organization = organizations.names(List.of(organizationId)).get(organizationId);
		return organization == null ? null : organization.name();
	}

	/** The other side as the person who started is shown it; null for GenAI Fund, which the screen names. */
	private static @Nullable String counterpartName(String kind, String subjectName,
			@Nullable String organizationName) {
		return switch (kind) {
			case MessagingRepository.TALENT -> subjectName;
			case MessagingRepository.SOLUTION -> organizationName;
			default -> null;
		};
	}

	private Names names(List<Listed> rows) {
		List<UUID> accounts = rows.stream()
			.flatMap(row -> Stream.of(row.conversation().starterAccountId(), row.lastSenderAccountId()))
			.filter(Objects::nonNull)
			.distinct()
			.toList();
		List<UUID> organizationIds = rows.stream()
			.flatMap(row -> Stream.of(row.conversation().starterOrganizationId(),
					row.conversation().recipientOrganizationId()))
			.filter(Objects::nonNull)
			.distinct()
			.toList();
		return new Names(identity.people(accounts), organizations.names(organizationIds));
	}

	private static MessagingEvent event(Kind kind, UUID conversationId) {
		return new MessagingEvent(kind, conversationId, null, null, null, null, null);
	}

	private static String preview(String body) {
		String line = body.strip().replaceAll("\\s+", " ");
		return line.length() <= PREVIEW ? line : line.substring(0, PREVIEW - 1).stripTrailing() + "…";
	}

	private static MessagingException notFound(UUID id) {
		return new MessagingException(MessagingErrorCode.CONVERSATION_NOT_FOUND, "No conversation " + id);
	}

}
