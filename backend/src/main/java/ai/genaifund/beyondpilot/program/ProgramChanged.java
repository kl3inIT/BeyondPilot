package ai.genaifund.beyondpilot.program;

import java.util.UUID;

/**
 * A program was saved, published or unpublished. It names the program only: a listener reads what it needs through
 * {@link ProgramService#indexed(UUID)}, which is the program as it is when the listener runs.
 */
public record ProgramChanged(UUID programId) {
}
