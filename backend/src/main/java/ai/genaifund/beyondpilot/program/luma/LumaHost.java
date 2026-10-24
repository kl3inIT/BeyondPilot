package ai.genaifund.beyondpilot.program.luma;

import com.fasterxml.jackson.annotation.JsonCreator;
import org.jspecify.annotations.Nullable;

/**
 * A host of an event as Luma shows it (BEY-245).
 * @param avatarUrl the host's picture on Luma; null when Luma gives none
 */
public record LumaHost(String name, @Nullable String avatarUrl) {

	/** A host a form kept as its name alone, before hosts had a picture. */
	@JsonCreator(mode = JsonCreator.Mode.DELEGATING)
	static LumaHost named(String name) {
		return new LumaHost(name, null);
	}

}
