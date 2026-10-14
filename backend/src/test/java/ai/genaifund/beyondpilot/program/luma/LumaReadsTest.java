package ai.genaifund.beyondpilot.program.luma;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

/**
 * What the job reads of Luma, on the calendar "GenAI Fund - Official" and the page of TinyFish, Big Minds as Luma
 * served them on 14 October 2026, cut to one past event and one to come.
 */
class LumaReadsTest {

	@Test
	void theFeedGivesEachEventItsIdentifierTimesAndPage() throws IOException {
		List<LumaFeed.Event> events = LumaFeed.read(resource("gaf.ics"));

		assertThat(events).containsExactly(
				new LumaFeed.Event("evt-Lql1ttj9FE6YZxw", Instant.parse("2026-06-20T06:30:00Z"),
						Instant.parse("2026-06-20T11:30:00Z"), URI.create("https://luma.com/oawz935f")),
				// The address is folded over two lines in the feed.
				new LumaFeed.Event("evt-hoC70wwoFbylEa1", Instant.parse("2026-10-26T11:00:00Z"),
						Instant.parse("2026-10-26T13:00:00Z"), URI.create("https://luma.com/gaf-tinyfish-vn")));
		Instant now = Instant.parse("2026-10-14T05:00:00Z");
		assertThat(events.get(0).over(now)).isTrue();
		assertThat(events.get(1).over(now)).isFalse();
	}

	@Test
	void whatIsNotACalendarIsRefused() {
		assertThatThrownBy(() -> LumaFeed.read("<html>Too many requests</html>")).isInstanceOf(IOException.class);
	}

	@Test
	void thePageGivesTheEventItsDescriptionCoverAndTimesWithTheirOffset() throws IOException {
		LumaEventPage.Event event = LumaEventPage.read(resource("tinyfish.html")).orElseThrow();

		assertThat(event.name()).isEqualTo("TinyFish, Big Minds");
		assertThat(event.description()).startsWith(
				"A private dinner for Vietnam's strongest CTOs, CIOs and AI engineers, with TinyFish's leadership.\n");
		assertThat(event.startsAt()).isEqualTo(OffsetDateTime.parse("2026-10-26T18:00:00+07:00"));
		assertThat(event.endsAt()).isEqualTo(OffsetDateTime.parse("2026-10-26T20:00:00+07:00"));
		assertThat(event.online()).isFalse();
		// Luma keeps the place of this dinner for those who register.
		assertThat(event.city()).isNull();
		assertThat(event.image()).hasToString("https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=1,"
				+ "anim=false,background=white,quality=75,width=1920,height=1920/uploads/5m/"
				+ "b3a97ce1-cb9e-4cee-96f4-95690324bee4.png");
	}

	@Test
	void aPlaceGivesItsCityAndTheCountryInWords() {
		LumaEventPage.Event event = LumaEventPage.read("""
				<script type="application/ld+json">{"@context":"https://schema.org","@type":"Event","name":"BS33",
				"startDate":"2026-06-20T13:30:00.000+07:00",
				"eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode",
				"location":{"@type":"Place","address":{"@type":"PostalAddress","addressCountry":"VN",
				"addressLocality":"Thành phố Hồ Chí Minh"}}}</script>
				""").orElseThrow();

		assertThat(event.city()).isEqualTo("Thành phố Hồ Chí Minh");
		assertThat(event.country()).isEqualTo("Vietnam");
		assertThat(event.endsAt()).isNull();
		assertThat(event.image()).isNull();
	}

	@Test
	void anOnlineEventHasNoPlace() {
		LumaEventPage.Event event = LumaEventPage.read("""
				<script type="application/ld+json">{"@type":"Event","name":"Office hours",
				"startDate":"2026-11-02T09:00:00.000+07:00",
				"eventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode",
				"location":{"@type":"VirtualLocation","url":"https://luma.com/office-hours"}}</script>
				""").orElseThrow();

		assertThat(event.online()).isTrue();
		assertThat(event.city()).isNull();
		assertThat(event.country()).isNull();
	}

	@Test
	void aPageWithoutAnEventGivesNone() {
		assertThat(LumaEventPage.read("<html><script type=\"application/ld+json\">{\"@type\":\"Organization\"}</script>"))
			.isEmpty();
		assertThat(LumaEventPage.read("<html><script type=\"application/ld+json\">not json</script>")).isEmpty();
		assertThat(LumaEventPage.read("<html><body>Not found</body></html>")).isEmpty();
	}

	@Test
	void onlyTheConfiguredHostsAreCalled() {
		LumaHttp http = new LumaHttp(Set.of("luma.com", "images.lumacdn.com"), Duration.ofSeconds(1));

		assertThat(http.allowed(URI.create("https://luma.com/gaf-tinyfish-vn"))).isTrue();
		assertThat(http.allowed(URI.create("https://images.lumacdn.com/uploads/a.png"))).isTrue();
		assertThat(http.allowed(URI.create("https://evil.example/luma.com"))).isFalse();
		assertThat(http.allowed(URI.create("https://luma.com.evil.example/"))).isFalse();
		assertThat(http.allowed(URI.create("file:///etc/passwd"))).isFalse();
		assertThatThrownBy(() -> http.get(URI.create("http://127.0.0.1/"), "text/html", 10))
			.isInstanceOf(IOException.class);
	}

	private static String resource(String name) throws IOException {
		try (InputStream in = LumaReadsTest.class.getResourceAsStream("/program/luma/" + name)) {
			return new String(in.readAllBytes(), StandardCharsets.UTF_8);
		}
	}

}
