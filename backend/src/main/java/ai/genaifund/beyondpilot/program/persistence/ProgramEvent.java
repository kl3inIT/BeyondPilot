package ai.genaifund.beyondpilot.program.persistence;

import java.time.Instant;

import jakarta.persistence.Embeddable;

import org.jspecify.annotations.Nullable;

/** A session of a program that people register for somewhere else. */
@Embeddable
public record ProgramEvent(String title, Instant startsAt, @Nullable Instant endsAt, boolean online,
		@Nullable String city, @Nullable String country, @Nullable String registrationUrl) {
}
