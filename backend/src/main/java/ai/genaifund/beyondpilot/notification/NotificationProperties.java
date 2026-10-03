package ai.genaifund.beyondpilot.notification;

import jakarta.validation.constraints.NotBlank;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * @param from the sender address of every email, for example {@code BeyondPilot <no-reply@example.org>}
 */
@Validated
@ConfigurationProperties("beyondpilot.notification")
record NotificationProperties(@NotBlank String from) {
}
