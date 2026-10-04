package ai.genaifund.beyondpilot.identity;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.dto.MeResponse;
import ai.genaifund.beyondpilot.identity.persistence.Account;
import ai.genaifund.beyondpilot.identity.persistence.AccountRepository;
import ai.genaifund.beyondpilot.identity.persistence.ExternalIdentity;
import ai.genaifund.beyondpilot.identity.persistence.ExternalIdentityRepository;
import ai.genaifund.beyondpilot.identity.persistence.PlatformRole;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Accounts and their sign-ins. An address is one account however its owner proves it: a code sent to it and a Google
 * sign-in with the same verified address reach the same account.
 */
@Service
@EnableConfigurationProperties(IdentityProperties.class)
public class IdentityService {

	private static final Logger LOG = LoggerFactory.getLogger(IdentityService.class);

	private final AccountRepository accounts;
	private final ExternalIdentityRepository externalIdentities;
	private final IdentityProperties properties;

	private final AuditTrail audit;

	IdentityService(AccountRepository accounts, ExternalIdentityRepository externalIdentities,
			IdentityProperties properties, AuditTrail audit) {
		this.accounts = accounts;
		this.externalIdentities = externalIdentities;
		this.properties = properties;
		this.audit = audit;
	}

	/**
	 * Signs in the owner of an address that was just proven by typing the code sent to it.
	 * @throws IdentityException when the account is disabled
	 */
	@Transactional
	public Actor signInWithEmail(String email) {
		return completeSignIn(findOrCreate(email, null), "email_code");
	}

	/**
	 * Signs in a Google user. The subject finds a returning user even after the address changed at Google; a first
	 * sign-in joins the account of the address, which Google must have verified.
	 * @throws IdentityException when the address is not verified, or the account is disabled
	 */
	@Transactional
	public Actor signInWithGoogle(String subject, String email, boolean emailVerified, @Nullable String name) {
		Account account = externalIdentities.findByProviderAndSubject(ExternalIdentity.GOOGLE, subject)
			.flatMap(identity -> accounts.findById(identity.getAccountId()))
			.orElseGet(() -> {
				if (!emailVerified) {
					throw new IdentityException(IdentityErrorCode.EMAIL_NOT_VERIFIED,
							"Google sign-in with an unverified address");
				}
				Account joined = findOrCreate(email, name);
				externalIdentities.insertIfAbsent(UUID.randomUUID(), joined.getId(), ExternalIdentity.GOOGLE, subject);
				return joined;
			});
		account.nameIfUnnamed(name);
		return completeSignIn(account, "google");
	}

	/**
	 * The account behind the caller, read now so that a changed role or status shows at once.
	 * @throws IdentityException when the account is disabled
	 */
	@Transactional(readOnly = true)
	public MeResponse me(Actor actor) {
		Account account = active(actor);
		return new MeResponse(account.getId(), account.getEmail(), account.getDisplayName(),
				account.getPlatformRole().name().toLowerCase(Locale.ROOT));
	}

	/**
	 * Refuses a caller whose account has been disabled since they signed in.
	 * @throws IdentityException when the account is disabled or gone
	 */
	@Transactional(readOnly = true)
	public void requireActive(Actor actor) {
		active(actor);
	}

	/** Whether the caller is GenAI Fund staff now, whatever they were when they signed in. */
	@Transactional(readOnly = true)
	public boolean isOperator(Actor actor) {
		return accounts.findById(actor.accountId())
			.filter(account -> !account.isDisabled())
			.map(Account::isOperator)
			.orElse(false);
	}

	private Account active(Actor actor) {
		return accounts.findById(actor.accountId())
			.filter(found -> !found.isDisabled())
			.orElseThrow(() -> new IdentityException(IdentityErrorCode.ACCOUNT_DISABLED,
					"Session of a disabled or missing account " + actor.accountId()));
	}

	private Account findOrCreate(String email, @Nullable String name) {
		return accounts.findByEmail(email).orElseGet(() -> {
			accounts.insertIfAbsent(UUID.randomUUID(), email, name == null || name.isBlank() ? null : name.strip());
			return accounts.findByEmail(email).orElseThrow();
		});
	}

	private Actor completeSignIn(Account account, String method) {
		if (account.isDisabled()) {
			throw new IdentityException(IdentityErrorCode.ACCOUNT_DISABLED,
					"Sign-in to disabled account " + account.getId());
		}
		if (account.getPlatformRole() != PlatformRole.OPERATOR && properties.isOperatorEmail(account.getEmail())) {
			account.makeOperator();
			// Nobody did this: the server configuration names the address. The event has no actor.
			audit.record(new AuditRecord(AuditAction.OPERATOR_GRANT, null,
					new AuditRecord.Resource("account", account.getId().toString(), account.label()),
					Map.of("source", "configuration")));
		}
		account.recordSignIn(Instant.now());
		LOG.atInfo()
			.addKeyValue("event", "identity.sign_in.succeeded")
			.addKeyValue("account_id", account.getId())
			.addKeyValue("method", method)
			.log("Signed in");
		return new Actor(account.getId());
	}
}
