"""Regression coverage for the merge of the organizations the old platform holds twice."""

import unittest

import duplicates
import records


class DuplicatesTest(unittest.TestCase):
    def test_what_v1_knew_is_tied_to_the_organization_each_company_became(self):
        facts = duplicates.v1_facts(
            [{"startup_code": "ACME", "is_active": True, "updated_at": "2026-01-03 10:00:00"},
             {"startup_code": None, "is_active": True}],
            [{"id": "e1", "isActive": False, "updatedAt": None}])

        self.assertEqual(facts, [
            (str(records.ident("startup-organization", "ACME")), str(records.ident("startup-solution", "ACME")), True,
             "2026-01-03 10:00:00"),
            (str(records.ident("enterprise-organization", "e1")), None, False, ""),
        ])

    def test_the_merge_moves_what_the_application_moves_and_keeps_the_duplicate_as_a_record(self):
        sql = duplicates.sql([("5d0f6c3e-4a51-4f43-9a1c-7e2b8f0c6a74", None, True, "2026-01-03")])

        for table in ("organization_invitation", "organization_join_request", "solution", "offer", "use_case",
                      "proposal", "use_case_proposal", "introduction_request", "talent_enquiry"):
            self.assertIn(f"update {table}", sql)
        self.assertIn("set status = 'merged', merged_into_id = pair.kept", sql)
        self.assertNotIn("delete from organization ", sql)
        self.assertNotIn("delete from solution", sql)

    def test_a_group_with_a_member_who_signed_in_is_left_for_a_person(self):
        sql = duplicates.sql([])

        self.assertIn("a member of the group has signed in", sql)
        self.assertIn("a.last_login_at is not null", sql)
        self.assertIn("for pair in select * from merge_plan where left_because is null loop", sql)
        # A member who never signed in moves as the application moves one.
        self.assertIn("update organization_member set organization_id = pair.kept, role = 'member', "
                      "merged_from_id = pair.duplicate", sql)

    def test_one_name_is_one_company_with_one_domain_or_when_a_person_found_so(self):
        sql = duplicates.sql([], {"acme": {"website": "https://acme.example"}, "bolt": {"several": True}})

        self.assertIn("count(distinct c.domain) filter (where c.domain <> '') = 1", sql)
        self.assertIn("insert into legacy_same values ('acme', 'https://acme.example', false);", sql)
        self.assertIn("insert into legacy_same values ('bolt', null, true);", sql)
        self.assertIn("or c.key in (select key from legacy_same)", sql)

    def test_a_company_found_to_have_several_products_keeps_every_solution(self):
        sql = duplicates.sql([], {"bolt": {"several": True}})

        self.assertIn("and key not in (select key from legacy_same where several)", sql)
        # Only what this run merged is looked at, so a later run without the list refuses nothing of an earlier one.
        self.assertIn("s.organization_id in (select kept from merge_plan", sql)

    def test_an_approved_organization_is_kept_before_another(self):
        self.assertIn("order by (c.status = 'approved') desc, c.has_deck desc", duplicates.sql([]))

    def test_a_duplicate_solution_is_refused_as_a_duplicate_not_deleted(self):
        sql = duplicates.sql([])

        self.assertIn("set status = 'rejected', decision_reason = 'duplicate'", sql)
        self.assertIn("partition by s.organization_id, pg_temp.name_key(s.name)", sql)
        # Search and matching read an approved solution listed or not, so taking one off the list would not do.
        self.assertNotIn("listed = false", sql)
        # Production holds the import in review: a duplicate that waits for review is refused too, a draft is not.
        self.assertIn("where s.status in ('approved', 'in_review')", sql)

    def test_a_matching_result_a_person_acted_on_stays(self):
        sql = duplicates.sql([])

        self.assertIn("delete from matching_candidate c", sql)
        self.assertIn("not exists (select 1 from matching_decision d where d.candidate_id = c.id)", sql)
        self.assertIn("not exists (select 1 from matching_feedback f where f.candidate_id = c.id)", sql)


if __name__ == "__main__":
    unittest.main()
