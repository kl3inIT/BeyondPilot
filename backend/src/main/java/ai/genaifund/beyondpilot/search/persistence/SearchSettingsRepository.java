package ai.genaifund.beyondpilot.search.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SearchSettingsRepository extends JpaRepository<SearchSettings, Short> {

	/** The one row, which the migration creates. */
	default SearchSettings current() {
		return findById(SearchSettings.ID).orElseThrow(() -> new IllegalStateException("The search settings row is missing"));
	}

}
