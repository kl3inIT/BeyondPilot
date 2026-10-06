package ai.genaifund.beyondpilot.notification.template;

import java.util.Objects;
import java.util.regex.Pattern;

/**
 * What the fixed layout of every email takes from the settings and the site.
 * @param accentColor a six-digit hex colour for buttons and links
 * @param footer the plain-text note in the band at the bottom of every email
 * @param siteUrl the public address of the site, without a trailing slash; the GenAI Fund logo is read from it
 */
public record Appearance(String accentColor, String footer, String siteUrl) {

	public static final Pattern HEX_COLOR = Pattern.compile("#[0-9A-Fa-f]{6}");

	public static final String DEFAULT_ACCENT = "#0070C0";

	public static final String DEFAULT_FOOTER = "You receive this email because you use BeyondPilot. It was sent from an "
			+ "address that is not read.";

	public Appearance {
		Objects.requireNonNull(footer, "footer must not be null");
		Objects.requireNonNull(siteUrl, "siteUrl must not be null");
		if (!HEX_COLOR.matcher(accentColor).matches()) {
			throw new IllegalArgumentException("The accent colour must be a six-digit hex colour");
		}
		siteUrl = siteUrl.endsWith("/") ? siteUrl.substring(0, siteUrl.length() - 1) : siteUrl;
	}

	/** The logo on the white header. */
	public String logoUrl() {
		return siteUrl + "/brand/genaifund-logo.png";
	}

	/** The logo on the dark band at the bottom. */
	public String logoOnDarkUrl() {
		return siteUrl + "/brand/genaifund-logo-white.png";
	}

	/** The site's address as it is written for a reader: no scheme. */
	public String siteHost() {
		return siteUrl.replaceFirst("^https?://", "");
	}

}
