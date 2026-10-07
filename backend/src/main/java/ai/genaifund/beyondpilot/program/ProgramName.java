package ai.genaifund.beyondpilot.program;

import java.util.UUID;

/**
 * A program as another module names it, for instance a use case that belongs to it.
 * @param published whether visitors see it; a draft's name is for operators only
 */
public record ProgramName(UUID id, String name, String slug, boolean published) {
}
