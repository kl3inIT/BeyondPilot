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
            (str(records.ident("startup-organization", "ACME")), True, "2026-01-03 10:00:00"),
            (str(records.ident("enterprise-organization", "e1")), False, ""),
        ])

    def test_the_merge_moves_what_the_application_moves_and_keeps_the_duplicate_as_a_record(self):
        sql = duplicates.sql([("5d0f6c3e-4a51-4f43-9a1c-7e2b8f0c6a74", True, "2026-01-03")])

        for table in ("organization_invitation", "organization_join_request", "solution", "offer", "use_case",
                      "proposal", "use_case_proposal", "introduction_request", "talent_enquiry"):
            self.assertIn(f"update {table} ", sql)
        self.assertIn("set status = 'merged', merged_into_id = pair.kept", sql)
        self.assertNotIn("delete from organization ", sql)
        self.assertNotIn("delete from solution", sql)

    def test_a_group_with_members_or_an_unapproved_keeper_is_left_for_a_person(self):
        sql = duplicates.sql([])

        self.assertIn("an organization of the group has members", sql)
        self.assertIn("the one to keep is not approved", sql)
        self.assertIn("for pair in select * from merge_plan where left_because is null loop", sql)

    def test_a_duplicate_solution_is_taken_off_the_list_not_deleted(self):
        sql = duplicates.sql([])

        self.assertIn("update solution s set listed = false", sql)
        self.assertIn("partition by s.organization_id, pg_temp.name_key(s.name)", sql)


if __name__ == "__main__":
    unittest.main()
