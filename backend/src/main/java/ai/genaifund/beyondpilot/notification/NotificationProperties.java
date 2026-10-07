package ai.genaifund.beyondpilot.notification;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * What email needs from the environment. Who delivers it, and with which credentials, is not here: operators set it in
 * the database.
 * @param encryptionKey 32 bytes in Base64 that encrypt the providers' secrets in the database; without it no secret
 * is saved or read, so no provider that needs one sends
 * @param siteUrl the public address of the site, which emails link to and read the GenAI Fund logo from
 */
@Validated
@ConfigurationProperties("beyondpilot.notification")
public record NotificationProperties(@Nullable String encryptionKey, @NotBlank String siteUrl,
		@DefaultValue @Valid Resend resend) {

	/** @param apiUrl where Resend's API answers */
	public record Resend(@DefaultValue("https://api.resend.com") @NotBlank String apiUrl) {
	}

}
