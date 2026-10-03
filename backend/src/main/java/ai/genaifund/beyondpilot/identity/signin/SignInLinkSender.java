package ai.genaifund.beyondpilot.identity.signin;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.Locale;
import java.util.regex.Pattern;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import ai.genaifund.beyondpilot.identity.IdentityProperties;
import ai.genaifund.beyondpilot.identity.persistence.SignInLinkQueryRepository;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.notification.NotificationException;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.ott.OneTimeToken;
import org.springframework.security.web.authentication.ott.OneTimeTokenGenerationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Emails the sign-in link once Spring Security has generated its token. The answer is the same whether or not the
 * address has an account, so the endpoint tells nobody who is registered.
 */
@Component
class SignInLinkSender implements OneTimeTokenGenerationSuccessHandler {

	private static final Logger LOG = LoggerFactory.getLogger(SignInLinkSender.class);

	private static final Pattern EMAIL = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");
	private static final int MAX_EMAIL_LENGTH = 320;
	private static final String MAIL_RETRY_SECONDS = "30";

	private final EmailService emails;
	private final SignInLinkQueryRepository links;
	private final IdentityProperties properties;

	SignInLinkSender(EmailService emails, SignInLinkQueryRepository links, IdentityProperties properties) {
		this.emails = emails;
		this.links = links;
		this.properties = properties;
	}

	@Override
	public void handle(HttpServletRequest request, HttpServletResponse response, OneTimeToken token)
			throws IOException {
		String email = token.getUsername();
		if (email.length() > MAX_EMAIL_LENGTH || !EMAIL.matcher(email).matches()) {
			response.sendError(HttpStatus.BAD_REQUEST.value());
			return;
		}
		// The token of this request is already stored, so the count includes it.
		if (links.countUnexpired(email, Instant.now()) > properties.signInLinkLimit()) {
			LOG.atWarn().addKeyValue("event", "identity.sign_in_link.limited").log("Sign-in link limit reached");
			// Room for another link opens when the oldest one expires, at the latest after one lifetime.
			response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(properties.signInLinkLifetime().toSeconds()));
			response.sendError(HttpStatus.TOO_MANY_REQUESTS.value());
			return;
		}
		Locale locale = "vi".equals(request.getParameter("locale")) ? Locale.forLanguageTag("vi") : Locale.ENGLISH;
		try {
			emails.sendSignInLink(email, link(token, locale, request.getParameter("returnTo")),
					properties.signInLinkLifetime(), locale);
		}
		catch (NotificationException exception) {
			response.setHeader(HttpHeaders.RETRY_AFTER, MAIL_RETRY_SECONDS);
			response.sendError(HttpStatus.SERVICE_UNAVAILABLE.value());
			return;
		}
		response.setStatus(HttpStatus.NO_CONTENT.value());
	}

	/** The page of the web application that redeems the token; it also checks {@code returnTo} before following it. */
	private URI link(OneTimeToken token, Locale locale, @Nullable String returnTo) {
		UriComponentsBuilder link = UriComponentsBuilder.fromUri(properties.publicUrl())
			.path("vi".equals(locale.getLanguage()) ? "/vi/sign-in/link" : "/sign-in/link")
			.queryParam("token", token.getTokenValue());
		if (returnTo != null && returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.contains("\\")) {
			link.queryParam("returnTo", returnTo);
		}
		return link.encode().build().toUri();
	}
}
