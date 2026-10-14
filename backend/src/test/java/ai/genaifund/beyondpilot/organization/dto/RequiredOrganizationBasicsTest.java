package ai.genaifund.beyondpilot.organization.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Year;
import java.util.List;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

class RequiredOrganizationBasicsTest {

    @Test
    void soloGivesOnlyNameAndCountryAndTeamGivesAShortDescription() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            var solo = new SaveOrganizationBasicsRequest.Builder("An Tran", "independent_builder", "just_me", List.of(), "VN").build();
            assertThat(validator.validate(solo)).isEmpty();
            var team = new SaveOrganizationBasicsRequest.Builder("Doc Team", "builder_team", "2_9", List.of(), "VN");
            assertThat(validator.validate(team.build())).extracting(v -> v.getPropertyPath().toString()).containsExactly("description");
            assertThat(validator.validate(team.description("Built document assistants.").build())).isEmpty();
        }
    }

    @Test
    void companyMustGiveWebsiteYearAndDescriptionAtTheirOwnFields() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            var company = new SaveOrganizationBasicsRequest.Builder("Doc Company", "company", "2_9", List.of("insurance"), "VN");
            assertThat(validator.validate(company.build())).extracting(v -> v.getPropertyPath().toString())
                .containsExactlyInAnyOrder("website", "foundedYear", "description");
            assertThat(validator.validate(company.website("https://doc.example").foundedYear(2021)
                .description("Insurance document assistants.").build())).isEmpty();
            assertThat(validator.validate(company.foundedYear(Year.now().getValue() + 1).build()))
                .extracting(v -> v.getPropertyPath().toString()).containsExactly("foundedYear");
            assertThat(validator.validate(company.foundedYear(2021).website("not-a-url").build()))
                .extracting(v -> v.getPropertyPath().toString()).containsExactly("website");
        }
    }

    @Test
    void descriptionIsBoundedAt280CharactersNotTheFormerBackgroundLimit() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            var team = new SaveOrganizationBasicsRequest.Builder("Doc Team", "builder_team", "2_9", List.of(), "VN");
            assertThat(validator.validate(team.description("x".repeat(280)).build())).isEmpty();
            assertThat(validator.validate(team.description("x".repeat(281)).build()))
                .extracting(v -> v.getPropertyPath().toString()).containsExactly("description");
        }
    }
}
