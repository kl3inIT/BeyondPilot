package ai.genaifund.beyondpilot.search;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Document;
import ai.genaifund.beyondpilot.talent.IndexedTalent;
import ai.genaifund.beyondpilot.talent.TalentDirectory;
import ai.genaifund.beyondpilot.talent.TalentProfileChanged;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Keeps the approved, listed talent profiles in the index; an unlisted profile is taken out. A change is read again
 * from the talent module, so a late or repeated delivery writes what the profile is now.
 */
@Component
class TalentIndexing {

	private final TalentDirectory talent;

	private final SearchDocumentRepository index;

	TalentIndexing(TalentDirectory talent, SearchDocumentRepository index) {
		this.talent = talent;
		this.index = index;
	}

	@ApplicationModuleListener
	void on(TalentProfileChanged changed) {
		UUID id = changed.profileId();
		talent.indexed(id)
			.ifPresentOrElse(profile -> index.save(document(profile)),
					() -> index.remove(SearchDocumentRepository.TALENT, id));
	}

	/** Saves every approved, listed profile and takes out every other. */
	Rebuilt rebuild() {
		List<IndexedTalent> listed = talent.indexedAll();
		listed.forEach(profile -> index.save(document(profile)));
		int removed = index.removeAllExcept(SearchDocumentRepository.TALENT,
				listed.stream().map(IndexedTalent::id).toList());
		return new Rebuilt(listed.size(), removed);
	}

	static Document document(IndexedTalent profile) {
		Map<String, Object> facets = new LinkedHashMap<>();
		Cards.put(facets, Cards.COUNTRY, profile.country());
		Cards.put(facets, Cards.AVAILABILITY, profile.availability());
		Cards.put(facets, Cards.ROLES, profile.roles());
		Cards.put(facets, Cards.SKILLS, profile.skills());
		String keywords = Cards.words(profile.roles(), profile.skills());
		return new Document(SearchDocumentRepository.TALENT, profile.id(), profile.slug(), profile.name(),
				profile.headline(), Objects.requireNonNullElse(profile.bio(), ""), keywords,
				Cards.lines(profile.name(), profile.headline(), keywords, profile.bio()), facets, true, null, null);
	}

}
