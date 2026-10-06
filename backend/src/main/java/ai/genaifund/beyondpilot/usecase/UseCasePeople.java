package ai.genaifund.beyondpilot.usecase;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.usecase.dto.UseCasePersonResponse;
import org.springframework.stereotype.Component;

/** Names the people behind a use case: who wrote it, sent it and decided on it, as a reader may be shown them. */
@Component
class UseCasePeople {

	private final IdentityService identity;

	UseCasePeople(IdentityService identity) {
		this.identity = identity;
	}

	/**
	 * The given accounts as the viewer sees them: their name, whether it is the viewer, whether they work for GenAI
	 * Fund. An account that no longer exists has an empty name.
	 */
	Map<UUID, UseCasePersonResponse> of(Actor viewer, Collection<UUID> accountIds) {
		Map<UUID, Person> named = identity.people(accountIds);
		Map<UUID, UseCasePersonResponse> people = new HashMap<>();
		for (UUID id : accountIds) {
			Person person = named.get(id);
			people.put(id, person == null ? new UseCasePersonResponse("", id.equals(viewer.accountId()), false)
					: new UseCasePersonResponse(person.label(), id.equals(viewer.accountId()),
							identity.isOperator(new Actor(id))));
		}
		return people;
	}
}
