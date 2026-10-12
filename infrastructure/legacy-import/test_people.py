"""Regression coverage for the invitations written for the people of the old platform."""

import unittest

import people
import records


def person(key, company, email, position=None, registered="2025-01-01", title=None):
    return {"id": key, "startupId": company, "email": email, "position": position, "jobTitle": title,
            "createdAt": registered}


class InvitationTest(unittest.TestCase):
    organizations = {"solo": records.ident("startup-organization", "SOLO"),
                     "team": records.ident("startup-organization", "TEAM"),
                     "flat": records.ident("startup-organization", "FLAT")}

    def roles(self, rows):
        found, left_out = people.invitations(rows, "startupId", self.organizations)
        return {one.email: one.role for one in found}, left_out

    def test_the_only_person_of_a_company_owns_it(self):
        roles, _ = self.roles([person("1", "solo", "Sales@Solo.example", "Sales / Marketing")])

        self.assertEqual(roles, {"sales@solo.example": "owner"})

    def test_of_several_the_one_who_founded_it_owns_it_whoever_registered_first(self):
        roles, _ = self.roles([
            person("1", "team", "dev@team.example", "Developer / Engineer", "2025-01-01"),
            person("2", "team", "late@team.example", "Entrepreneur (Founder / Co-Founder)", "2025-03-01"),
            person("3", "team", "early@team.example", "Director", "2025-02-01", title="CEO / Founder"),
        ])

        self.assertEqual(roles, {"early@team.example": "owner", "late@team.example": "member",
                                 "dev@team.example": "member"})

    def test_with_no_founder_the_first_to_register_owns_it(self):
        roles, _ = self.roles([
            person("1", "flat", "second@flat.example", "Director", "2025-02-01"),
            person("2", "flat", "first@flat.example", "Business Executive", "2025-01-01"),
        ])

        self.assertEqual(roles, {"first@flat.example": "owner", "second@flat.example": "member"})

    def test_a_person_without_an_address_or_a_loaded_company_gets_none(self):
        roles, left_out = self.roles([
            person("1", "solo", "not an address"),
            person("2", "test startup", "a@b.example"),
            {"id": "3", "startupId": None, "enterpriseId": "an enterprise", "email": "c@d.example"},
        ])

        self.assertEqual(roles, {})
        self.assertEqual(sum(left_out.values()), 2)

    def test_the_same_person_and_company_give_the_same_invitation(self):
        rows = [person("1", "solo", "a@solo.example")]

        first, _ = people.invitations(rows, "startupId", self.organizations)
        second, _ = people.invitations(rows, "startupId", self.organizations)

        self.assertEqual(first[0].id, second[0].id)

    def test_a_test_startup_gives_its_people_no_organization(self):
        found = people.startup_organizations([
            {"id": "a", "startup_code": "REAL", "company_name": "Real", "is_active": True},
            {"id": "b", "startup_code": "TEST", "company_name": "Test", "is_active": True},
            {"id": "c", "startup_code": None, "company_name": "No Code"},
        ])

        self.assertEqual(found, {"a": records.ident("startup-organization", "REAL")})

    def test_the_invitation_is_an_operators_and_sends_nothing(self):
        found, _ = people.invitations([person("1", "solo", "a@solo.example")], "startupId", self.organizations)
        text = people.sql(found)

        self.assertIn("'a@solo.example', 'owner', null);", text)
        self.assertIn("sent_by_operator", text)
        self.assertIn("the address belongs to an organization already", text)
        self.assertIn("the address is an operator account", text)
        self.assertIn("now() + interval '100 years'", text)


if __name__ == "__main__":
    unittest.main()
