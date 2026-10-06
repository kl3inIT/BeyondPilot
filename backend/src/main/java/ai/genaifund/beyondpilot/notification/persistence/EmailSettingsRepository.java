package ai.genaifund.beyondpilot.notification.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailSettingsRepository extends JpaRepository<EmailSettings, Short> {

	/** The one row, which the migration creates. */
	default EmailSettings current() {
		return findById(EmailSettings.ID).orElseThrow(() -> new IllegalStateException("The email settings row is missing"));
	}

}
