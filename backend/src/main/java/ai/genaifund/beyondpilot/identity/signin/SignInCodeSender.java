package ai.genaifund.beyondpilot.identity.signin;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import ai.genaifund.beyondpilot.identity.IdentityProperties;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.notification.NotificationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.ott.OneTimeToken;
import org.springframework.security.web.authentication.ott.OneTimeTokenGenerationSuccessHandler;
import org.springframework.stereotype.Component;

/**
 * Splits a freshly generated sign-in code in two: the challenge goes into the session of the browser that asked, the
 * code goes to the mailbox. The answer is the same whether or not the address has an account, so the endpoint tells
 * nobody who is registered. {@link SignInCodeRequestGuard} has already refused a value that is not a plain address,
 * and {@link SignInCodeService} an address that holds its share of codes.
 */
@Component
class SignInCodeSender implements OneTimeTokenGenerationSuccessHandler {

	/** Where the session keeps the challenge of the newest code this browser asked for. */
	static final String CHALLENGE_ATTRIBUTE = SignInCodeSender.class.getName() + ".challenge";

	private static final String MAIL_RETRY_SECONDS = "30";

	private final EmailService emails;
	private final IdentityProperties properties;

	SignInCodeSender(EmailService emails, IdentityProperties properties) {
		this.emails = emails;
		this.properties = properties;
	}

	@Override
	public void handle(HttpServletRequest request, HttpServletResponse response, OneTimeToken token)
			throws IOException {
		String email = token.getUsername();
		// The guard decides first; these checks fail closed if a request ever reaches the handler around it.
		if (!(token instanceof SignInCode code) || !SignInCodeRequestGuard.isAddress(email)) {
			response.sendError(HttpStatus.BAD_REQUEST.value());
			return;
		}
		UUID challengeId = code.challengeId();
		if (challengeId == null) {
			long wait = Math.max(1, Duration.between(Instant.now(), code.getExpiresAt()).toSeconds());
			response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(wait));
			response.sendError(HttpStatus.TOO_MANY_REQUESTS.value());
			return;
		}
		Locale locale = "vi".equals(request.getParameter("locale")) ? Locale.forLanguageTag("vi") : Locale.ENGLISH;
		try {
			emails.sendSignInCode(email, code.getTokenValue(), properties.signInCodeLifetime(), locale);
		}
		catch (NotificationException exception) {
			response.setHeader(HttpHeaders.RETRY_AFTER, MAIL_RETRY_SECONDS);
			response.sendError(HttpStatus.SERVICE_UNAVAILABLE.value());
			return;
		}
		// Only now does this browser hold a challenge: a code that was never sent cannot be typed.
		request.getSession().setAttribute(CHALLENGE_ATTRIBUTE, challengeId.toString());
		response.setStatus(HttpStatus.NO_CONTENT.value());
	}
}
