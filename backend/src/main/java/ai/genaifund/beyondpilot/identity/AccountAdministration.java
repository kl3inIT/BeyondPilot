package ai.genaifund.beyondpilot.identity;

import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.dto.AccountListRequest;
import ai.genaifund.beyondpilot.identity.dto.AccountListResponse;
import ai.genaifund.beyondpilot.identity.persistence.Account;
import ai.genaifund.beyondpilot.identity.persistence.AccountQueryRepository;
import ai.genaifund.beyondpilot.identity.persistence.AccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with accounts: read the list, disable and enable an account, grant and withdraw the operator role.
 * Every operation first checks that the caller is an operator now, and every change is recorded in the audit trail in
 * its own transaction. A command sets a state, so repeating it changes nothing and records nothing.
 */
@Service
public class AccountAdministration {

	static final int PAGE_SIZE = 25;

	private static final String ACCOUNT = "account";

	private final AccountRepository accounts;

	private final AccountQueryRepository accountList;

	private final IdentityProperties properties;

	private final AuditTrail audit;

	AccountAdministration(AccountRepository accounts, AccountQueryRepository accountList,
			IdentityProperties properties, AuditTrail audit) {
		this.accounts = accounts;
		this.accountList = accountList;
		this.properties = properties;
		this.audit = audit;
	}

	/**
	 * One page of the accounts the request selects, latest sign-in first.
	 * @throws IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AccountListResponse list(Actor actor, AccountListRequest request) {
		operator(actor);
		String text = request.q() == null || request.q().isBlank() ? null : request.q().strip();
		int page = request.page() == null ? 1 : request.page();
		return new AccountListResponse(
				accountList.page(text, request.status(), request.role(), properties.operatorEmails(), PAGE_SIZE,
						(long) (page - 1) * PAGE_SIZE),
				page, PAGE_SIZE, accountList.count(text, request.status(), request.role()));
	}

	/**
	 * Stops the account from signing in and its open sessions from answering. Nothing it holds is removed.
	 * @throws IdentityException when the caller is not an operator, the account does not exist, or it is the caller's
	 */
	@Transactional
	public void disable(Actor actor, UUID accountId) {
		Account operator = operator(actor);
		Account account = accountOfAnother(operator, accountId);
		if (!account.isDisabled()) {
			account.disable();
			record(AuditAction.ACCOUNT_DISABLE, operator, account, Map.of());
		}
	}

	/**
	 * Lets a disabled account sign in again.
	 * @throws IdentityException when the caller is not an operator or the account does not exist
	 */
	@Transactional
	public void enable(Actor actor, UUID accountId) {
		Account operator = operator(actor);
		Account account = account(accountId);
		if (account.isDisabled()) {
			account.enable();
			record(AuditAction.ACCOUNT_ENABLE, operator, account, Map.of());
		}
	}

	/**
	 * Makes the account an operator.
	 * @throws IdentityException when the caller is not an operator or the account does not exist
	 */
	@Transactional
	public void grantOperator(Actor actor, UUID accountId) {
		Account operator = operator(actor);
		Account account = account(accountId);
		if (!account.isOperator()) {
			account.makeOperator();
			record(AuditAction.OPERATOR_GRANT, operator, account, Map.of("source", "operator"));
		}
	}

	/**
	 * Takes the operator role from the account, which keeps everything else.
	 * @throws IdentityException when the caller is not an operator, the account does not exist, it is the caller's, or
	 * the server configuration names it as an operator
	 */
	@Transactional
	public void withdrawOperator(Actor actor, UUID accountId) {
		Account operator = operator(actor);
		Account account = accountOfAnother(operator, accountId);
		if (properties.isOperatorEmail(account.getEmail())) {
			throw new IdentityException(IdentityErrorCode.OPERATOR_CONFIGURED,
					"Withdrawal of the configured operator " + account.getId());
		}
		if (account.isOperator()) {
			account.withdrawOperator();
			record(AuditAction.OPERATOR_WITHDRAW, operator, account, Map.of());
		}
	}

	/** The caller's account, which must be an operator's and not disabled, read now and not from the session. */
	/**
	 * Whether the account is an operator now. Read from the database, so a withdrawn role or a disabled account stops
	 * counting at once, whatever its session still says.
	 */
	@Transactional(readOnly = true)
	public boolean isOperator(Actor actor) {
		return accounts.findById(actor.accountId()).filter(AccountAdministration::operates).isPresent();
	}

	private static boolean operates(Account account) {
		return account.isOperator() && !account.isDisabled();
	}

	private Account operator(Actor actor) {
		return accounts.findById(actor.accountId())
			.filter(AccountAdministration::operates)
			.orElseThrow(() -> new IdentityException(IdentityErrorCode.OPERATOR_REQUIRED,
					"Operator action by account " + actor.accountId()));
	}

	private Account account(UUID accountId) {
		return accounts.findForUpdate(accountId)
			.orElseThrow(() -> new IdentityException(IdentityErrorCode.ACCOUNT_NOT_FOUND,
					"No account " + accountId));
	}

	/** An operator who disabled or demoted themselves by a slip could leave an environment without a way in. */
	private Account accountOfAnother(Account operator, UUID accountId) {
		if (operator.getId().equals(accountId)) {
			throw new IdentityException(IdentityErrorCode.OWN_ACCOUNT,
					"Operator " + operator.getId() + " acting on their own account");
		}
		return account(accountId);
	}

	private void record(AuditAction action, Account operator, Account account, Map<String, String> details) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.getId(), operator.label(), operator.getEmail()),
				new AuditRecord.Resource(ACCOUNT, account.getId().toString(), account.label()), details));
	}

}
