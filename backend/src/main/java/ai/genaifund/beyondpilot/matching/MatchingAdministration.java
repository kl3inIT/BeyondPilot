package ai.genaifund.beyondpilot.matching;

import java.util.Map;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.matching.dto.MatchingSettingsResponse;
import ai.genaifund.beyondpilot.matching.dto.SaveMatchingSettingsRequest;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Settings;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The limits of matching, which operators set in Admin: how long a changed use case waits before its run, how many
 * runs a day its changes and its members may start, how many runs a day start in all, and how many solutions a run
 * judges. Each change is recorded in the audit log.
 */
@Service
public class MatchingAdministration {

	private final MatchingRepository matching;

	private final IdentityService identity;

	private final AuditTrail audit;

	MatchingAdministration(MatchingRepository matching, IdentityService identity, AuditTrail audit) {
		this.matching = matching;
		this.identity = identity;
		this.audit = audit;
	}

	/** @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator */
	@Transactional(readOnly = true)
	public MatchingSettingsResponse settings(Actor actor) {
		identity.requireOperator(actor);
		return response(matching.settings());
	}

	/**
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws MatchingException when the settings changed since the operator read them
	 */
	@Transactional
	public MatchingSettingsResponse save(Actor actor, SaveMatchingSettingsRequest request) {
		Operator operator = identity.requireOperator(actor);
		boolean saved = matching.saveSettings(new Settings(request.settleMinutes(), request.editRunsPerDay(),
				request.memberRunsPerDay(), request.runsPerDay(), request.candidates(), request.version()));
		if (!saved) {
			throw new MatchingException(MatchingErrorCode.SETTINGS_CHANGED,
					"Matching settings are no longer at version " + request.version());
		}
		audit.record(new AuditRecord(AuditAction.MATCHING_SETTINGS_CHANGE,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("matching_settings", "settings", "Matching settings"), Map.of()));
		return response(matching.settings());
	}

	private static MatchingSettingsResponse response(Settings settings) {
		return new MatchingSettingsResponse(settings.settleMinutes(), settings.editRunsPerDay(),
				settings.memberRunsPerDay(), settings.runsPerDay(), settings.candidates(), settings.version());
	}

}
