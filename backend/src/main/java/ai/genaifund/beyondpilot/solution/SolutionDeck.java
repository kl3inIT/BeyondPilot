package ai.genaifund.beyondpilot.solution;

import java.util.UUID;

import org.springframework.core.io.InputStreamSource;

/**
 * The deck of an approved solution, for the module that reads its pages.
 * @param fileId the stored file; another file is another deck
 * @param content the bytes, opened when they are read
 */
public record SolutionDeck(UUID fileId, String fileName, InputStreamSource content) {
}
