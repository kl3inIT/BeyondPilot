package ai.genaifund.beyondpilot.config;

import java.io.IOException;
import java.util.regex.Pattern;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;

/**
 * A provider round trip that fails returns the person to the sign-in page and leaves one line to trace it by. The
 * browser carries the provider's answer, so anyone can write it: only an error code of the usual shape is logged, and
 * never the provider's description.
 */
class ProviderSignInFailureHandler extends SimpleUrlAuthenticationFailureHandler {

	private static final Logger LOG = LoggerFactory.getLogger(ProviderSignInFailureHandler.class);

	private static final Pattern ERROR_CODE = Pattern.compile("[a-z_]{1,64}");

	private final String method;

	ProviderSignInFailureHandler(String method, String failureUrl) {
		super(failureUrl);
		this.method = method;
	}

	@Override
	public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
			AuthenticationException failure) throws IOException, ServletException {
		LOG.atWarn()
			.addKeyValue("event", "identity.sign_in.failed")
			.addKeyValue("method", method)
			.addKeyValue("error_type", failure.getClass().getSimpleName())
			.addKeyValue("error_code", errorCode(failure))
			.log("Sign-in failed");
		super.onAuthenticationFailure(request, response, failure);
	}

	private static String errorCode(AuthenticationException failure) {
		if (failure instanceof OAuth2AuthenticationException provider
				&& ERROR_CODE.matcher(provider.getError().getErrorCode()).matches()) {
			return provider.getError().getErrorCode();
		}
		return "other";
	}

}
