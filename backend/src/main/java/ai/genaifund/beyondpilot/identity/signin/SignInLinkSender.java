package ai.genaifund.beyondpilot.identity.signin;

import java.io.IOException;
import java.net.URI;
import java.util.Locale;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import ai.genaifund.beyondpilot.identity.IdentityProperties;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.notification.NotificationException;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.ott.OneTimeToken;
import org.springframework.security.web.authentication.ott.OneTimeTokenGenerationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Emails the sign-in link once Spring Security has generated its token. The answer is the same whether or not the
 * address has an account, so the endpoint tells nobody who is registered. {@link SignInLinkRequestGuard} has already
 * refused a value that is not a plain address and an address that holds its share of links.
 */
@Component
class SignInLinkSender implements OneTimeTokenGenerationSuccessHandler {

	private static final String MAIL_RETRY_SECONDS = "30";
	private static final int MAX_RETURN_TO_LENGTH = 2000;

	private final EmailService emails;
	private final IdentityProperties properties;

	SignInLinkSender(EmailService emails, IdentityProperties properties) {
		this.emails = emails;
		this.properties = properties;
	}

	/**
	 * A path of this origin, judged the way a browser reads it: a browser drops tabs and line breaks and treats a
	 * backslash as a slash, so a value such as slash, tab, slash, host would leave the site. The same rule guards the
	 * Google round trip in the config module.
	 */
	static boolean isLocalPath(@Nullable String path) {
		return path != null && path.length() <= MAX_RETURN_TO_LENGTH && path.startsWith("/") && !path.startsWith("//")
				&& !path.contains("\\")
				&& path.chars().noneMatch(character -> Character.isISOControl(character) || Character.isWhitespace(character));
	}

	@Override
	public void handle(HttpServletRequest request, HttpServletResponse response, OneTimeToken token)
			throws IOException {
		String email = token.getUsername();
		// Fail closed if a token was generated for something the guard would have refused.
		if (!SignInLinkRequestGuard.isAddress(email)) {
			response.sendError(HttpStatus.BAD_REQUEST.value());
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
		if (isLocalPath(returnTo)) {
			link.queryParam("returnTo", returnTo);
		}
		return link.encode().build().toUri();
	}
}
