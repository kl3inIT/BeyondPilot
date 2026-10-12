"""Regression coverage for the enterprises' logos read from the old platform's full export."""

import unittest

import enterprise_logos
import enterprises
import records

DRIVE = "https://drive.google.com/file/d/16sq7dLYU88jDIGDkB0Ol/view"


class EnterpriseLogoTest(unittest.TestCase):
    def test_a_logo_is_fetched_from_google_or_v1_and_from_nowhere_else(self):
        rows = [
            {"id": "1", "companyName": "On Drive", "logo": DRIVE},
            {"id": "2", "companyName": "Elsewhere", "logo": "https://cdn.example/logo.png"},
            {"id": "3", "companyName": "No Logo", "logo": None},
            {"id": "4", "companyName": "Test", "logo": DRIVE.replace("16sq", "17sq")},
        ]

        found = enterprise_logos.logos(rows)

        self.assertEqual([organization.name for organization, _ in found], ["On Drive"])
        self.assertEqual(found[0][1].url, "https://drive.google.com/uc?export=download&id=16sq7dLYU88jDIGDkB0Ol")

    def test_a_file_two_enterprises_name_goes_to_the_first(self):
        rows = [{"id": "1", "companyName": "First", "logo": DRIVE}, {"id": "2", "companyName": "Second", "logo": DRIVE}]

        self.assertEqual([organization.name for organization, _ in enterprise_logos.logos(rows)], ["First"])

    def test_a_logo_is_named_only_where_there_is_none_and_an_unnamed_file_is_removed(self):
        organization = enterprises.profile({"id": "1", "companyName": "Acme"})
        file_id = records.ident("file:organization_logo", "x")
        sql = enterprise_logos.sql([(organization, {
            "id": file_id, "object_key": f"organization_logo/2026/10/{file_id}", "public": True, "name": "logo.png",
            "type": "image/png", "size": 10})])

        self.assertIn(f"where id = '{organization.id}' and logo_file_id is null;", sql)
        self.assertIn("delete from storage_file f where f.id in (select id from legacy_ids)", sql)
        self.assertIn("-v operator=<operator account uuid>", sql)


if __name__ == "__main__":
    unittest.main()
