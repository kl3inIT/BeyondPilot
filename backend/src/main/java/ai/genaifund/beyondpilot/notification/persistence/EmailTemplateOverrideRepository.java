package ai.genaifund.beyondpilot.notification.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailTemplateOverrideRepository extends JpaRepository<EmailTemplateOverride, String> {
}
