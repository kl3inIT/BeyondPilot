package ai.genaifund.beyondpilot.organization.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

class OrganizationTeamBackgroundTest {

	@Test
	void aTeamMustGiveExperienceAtItsOwnFieldButOtherTypesNeedNot() {
		try (var factory = Validation.buildDefaultValidatorFactory()) {
			var validator = factory.getValidator();
			var team = new SaveOrganizationBasicsRequest("Doc Team", "builder_team", "2_9", List.of(), "VN", " ", null);
			assertThat(validator.validate(team)).extracting(violation -> violation.getPropertyPath().toString())
				.containsExactly("teamBackground");
			var company = new SaveOrganizationBasicsRequest("Doc Company", "company", "2_9", List.of("insurance"), "VN", null, null);
			assertThat(validator.validate(company)).isEmpty();
			var complete = new SaveOrganizationBasicsRequest("Doc Team", "builder_team", "2_9", List.of(), "VN", "Built document assistants.", null);
			assertThat(validator.validate(complete)).isEmpty();
		}
	}

	@Test
	void theLongExperienceLimitIsIndependentOfTheShortDescription() {
		try (var factory = Validation.buildDefaultValidatorFactory()) {
			var validator = factory.getValidator();
			var boundary = new SaveOrganizationBasicsRequest("Doc Team", "builder_team", "2_9", List.of(), "VN", "x".repeat(2000), null);
			assertThat(validator.validate(boundary)).isEmpty();
			var tooLong = new SaveOrganizationBasicsRequest("Doc Team", "builder_team", "2_9", List.of(), "VN", "x".repeat(2001), null);
			assertThat(validator.validate(tooLong)).extracting(violation -> violation.getPropertyPath().toString())
				.containsExactly("teamBackground");
		}
	}
}
