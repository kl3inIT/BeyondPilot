"""Regression coverage for the enterprise profiles read from the old platform's full export."""

import unittest

import enterprises
import records


class EnterpriseProfileTest(unittest.TestCase):
    def test_an_enterprise_becomes_the_organization_its_use_cases_were_given(self):
        organization = enterprises.profile({
            "id": "b2f9179c", "companyName": "Acme Beverages", "website": "www.acme.example/vn",
            "description": "Bottler. " * 60, "industry": "Fast-Moving Consumer Goods (FMCG)", "foundedYear": 1872,
            "employeeCount": "1,000–4,999 Employees", "headquarters": "Korea South",
        })

        self.assertEqual(organization.id, records.ident("enterprise-organization", "b2f9179c"))
        self.assertEqual(organization.website, "https://www.acme.example/vn")
        self.assertEqual(organization.country, "KR")
        self.assertEqual(organization.team_size, "1000_4999")
        self.assertEqual(organization.company_size_label, "1,000–4,999 Employees")
        self.assertEqual(organization.industries, ["consumer_goods"])
        self.assertEqual(organization.founded_year, 1872)
        self.assertLessEqual(len(organization.description), records.ORGANIZATION_DESCRIPTION)
        self.assertTrue(organization.description.endswith("…"))

    def test_a_band_that_straddles_ours_keeps_its_label_and_no_size(self):
        organization = enterprises.profile({"id": "1", "companyName": "Small", "employeeCount": "Less than 100 Employees"})

        self.assertIsNone(organization.team_size)
        self.assertEqual(organization.company_size_label, "Less than 100 Employees")

    def test_the_largest_bands_are_our_largest(self):
        for label in ("5,000–9,999 Employees", "10,000–49,999 Employees", "50,000 Employees or More"):
            self.assertEqual(enterprises.profile({"id": "1", "companyName": "Big", "employeeCount": label}).team_size,
                             "5000_plus")

    def test_a_website_is_an_address_or_nothing(self):
        self.assertEqual(enterprises.website("http://www.acme.example"), "http://www.acme.example")
        self.assertEqual(enterprises.website("acme.example"), "https://acme.example")
        self.assertIsNone(enterprises.website("acme example"))
        self.assertIsNone(enterprises.website("coming soon"))
        self.assertIsNone(enterprises.website("https://test.com"))
        self.assertIsNone(enterprises.website(None))

    def test_a_city_is_not_guessed_into_a_country(self):
        self.assertIsNone(enterprises.profile({"id": "1", "companyName": "Bank", "headquarters": "Zurich"}).country)

    def test_a_test_record_and_a_nameless_one_are_left_out(self):
        self.assertIsNone(enterprises.profile({"id": "1", "companyName": "Test"}))
        self.assertIsNone(enterprises.profile({"id": "1", "companyName": None}))

    def test_the_load_fills_what_is_empty_and_overwrites_nothing(self):
        sql = enterprises.fill_sql([enterprises.profile({"id": "1", "companyName": "O'Neil", "website": "oneil.example"})])

        self.assertIn("'https://oneil.example'", sql)
        self.assertIn("coalesce(nullif(o.website, ''), e.website)", sql)
        self.assertIn("coalesce(o.country, e.country)", sql)
        self.assertNotIn("insert into organization", sql)


if __name__ == "__main__":
    unittest.main()
