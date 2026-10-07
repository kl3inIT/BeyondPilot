package ai.genaifund.beyondpilot.identity.signin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.IdentityProperties;
import ai.genaifund.beyondpilot.identity.persistence.SignInChallenge;
import ai.genaifund.beyondpilot.identity.persistence.SignInChallengeRepository;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.ott.GenerateOneTimeTokenRequest;
import org.springframework.security.authentication.ott.OneTimeToken;
import org.springframework.security.authentication.ott.OneTimeTokenAuthenticationToken;
import org.springframework.security.authentication.ott.OneTimeTokenService;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sign-in codes behind Spring Security's one-time-token login. A code is six digits, so three things keep it safe:
 * it works only together with the challenge held in the session of the browser that asked for it, it takes only a
 * few guesses, and it expires. Whoever is sent someone else's code can do nothing with it, and nobody
 * can guess at, or lock, a code from another browser.
 */
@Service
class SignInCodeService implements OneTimeTokenService {

	private static final Logger LOG = LoggerFactory.getLogger(SignInCodeService.class);

	private static final Duration KEEP_EXPIRED = Duration.ofDays(1);

	private final SignInChallengeRepository challenges;
	private final IdentityProperties properties;
	private final SignInCodeLimits limits;
	private final SecureRandom random = new SecureRandom();

	SignInCodeService(SignInChallengeRepository challenges, IdentityProperties properties, SignInCodeLimits limits) {
		this.challenges = challenges;
		this.properties = properties;
		this.limits = limits;
	}

	@Override
	@Transactional
	public OneTimeToken generate(GenerateOneTimeTokenRequest request) {
		Instant now = Instant.now();
		// Requests for one address take turns here, so the limit holds however many arrive together.
		challenges.takeTurnFor(request.getUsername());
		Instant refusedUntil = limits.refusedUntil(request.getUsername(), now);
		if (refusedUntil != null) {
			LOG.atWarn().addKeyValue("event", "identity.sign_in_code.limited").log("Sign-in code limit reached");
			return SignInCode.refused(request.getUsername(), refusedUntil);
		}
		challenges.removeExpiredBefore(now.minus(KEEP_EXPIRED));
		UUID challengeId = UUID.randomUUID();
		String code = String.format("%06d", random.nextInt(1_000_000));
		Instant expiresAt = now.plus(request.getExpiresIn());
		challenges.save(new SignInChallenge(challengeId, request.getUsername(), hash(challengeId, code), now, expiresAt));
		return new SignInCode(challengeId, code, request.getUsername(), expiresAt);
	}

	/**
	 * Checks a typed code against the challenge of the session. A wrong code is counted even though this method then
	 * fails, hence {@code noRollbackFor}.
	 * @throws CredentialsExpiredException when the session holds no challenge, or its code has expired or been used
	 * @throws LockedException when too many wrong codes were typed
	 * @throws BadCredentialsException when the code is wrong
	 */
	@Override
	@Transactional(noRollbackFor = AuthenticationException.class)
	public OneTimeToken consume(OneTimeTokenAuthenticationToken authentication) {
		String presented = authentication.getTokenValue() == null ? "" : authentication.getTokenValue();
		int separator = presented.indexOf(SignInCodeConverter.SEPARATOR);
		UUID challengeId = separator < 0 ? null : challengeId(presented.substring(0, separator));
		String typed = presented.substring(separator + 1);
		SignInChallenge challenge = challengeId == null ? null : challenges.findById(challengeId).orElse(null);
		if (challengeId == null || challenge == null || !challenge.getExpiresAt().isAfter(Instant.now())) {
			throw new CredentialsExpiredException("No sign-in code is waiting in this session");
		}
		// The guess is paid for before it is looked at, so guesses sent together cannot outrun the limit.
		List<Integer> taken = challenges.takeGuess(challengeId, properties.signInCodeAttempts());
		if (taken.isEmpty()) {
			throw new LockedException("Too many wrong sign-in codes");
		}
		int used = taken.getFirst();
		if (!matches(challenge.getCodeHash(), hash(challengeId, typed))) {
			if (used >= properties.signInCodeAttempts()) {
				LOG.atWarn().addKeyValue("event", "identity.sign_in_code.locked").log("Sign-in code locked");
				throw new LockedException("Too many wrong sign-in codes");
			}
			throw new BadCredentialsException("Wrong sign-in code");
		}
		// Only the caller that removes the challenge signs in, so a code typed twice at once works once.
		if (challenges.remove(challengeId) != 1) {
			throw new CredentialsExpiredException("The sign-in code was already used");
		}
		return new SignInCode(challengeId, typed, challenge.getEmail(), challenge.getExpiresAt());
	}

	private static @Nullable UUID challengeId(String text) {
		try {
			return UUID.fromString(text);
		}
		catch (IllegalArgumentException exception) {
			return null;
		}
	}

	/** Salted with the challenge, so equal codes of different challenges store different values. */
	private static String hash(UUID challengeId, String code) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(digest.digest((challengeId + ":" + code).getBytes(StandardCharsets.UTF_8)));
		}
		catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException(exception);
		}
	}

	private static boolean matches(String expected, String actual) {
		return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
	}
}
