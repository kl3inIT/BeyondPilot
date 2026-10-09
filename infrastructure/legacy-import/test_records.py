"""Regression coverage for the v1 startup fields shown on a public solution page."""

import unittest

import records


class StartupDetailMappingTest(unittest.TestCase):
    def test_company_claims_and_product_details_keep_their_source_meaning(self):
        source = {
            "Startup Code": "REVVE",
            "Company Name": "Revve",
            "Company Size": "1–19 Employees",
            "Year Founded": 2024,
            "Registration Country": "United States",
            "Website": "https://revve.ai",
            "Brief Description": "Voice agents for customer operations.",
            "Product Names": "Revve AI|||Revve Voice",
            "Product Stage": "Production / Live",
            "Segment Focus": "B2B|||B2B2C",
            "Solution Types": "Conversational AI / Chatbots",
            "Target Industries": "Banking, FMCG, FnB",
            "Problems Solved": "Missed calls and abandoned customer journeys.",
            "Use Case Industries": "Banking, FMCG, FnB",
            "Use Case Descriptions": "Banking: contact-centre automation\nFMCG: sales enablement",
            "Core Technology": "OpenAI and Claude with a proprietary agent framework.",
            "Models / Tech Stack Used": "See above",
            "Infrastructure Used": "AWS, Google Cloud",
            "Monetization Model": "Subscription (e.g., SaaS)",
            "Best Customer Profile": "Mid-market and enterprise companies.",
            "Notable Paying Customers": "EagleView, Rollick.io, VIB",
            "Key Milestones": "US enterprise customers; Vietnam bank proof of concept.",
            "Competitors": "11x, Bland, Phonely",
            "Unique Value Proposition": "One memory across every channel.",
            "Funding Status": "Bootstrapped",
            "Funding Raised": None,
            "Is Active": True,
        }
        imported = records.Records()
        records.startup(source, imported)

        organization = imported.organizations[0]
        solution = imported.solutions[0]
        self.assertIsNone(organization.team_size)
        self.assertEqual(organization.company_size_label, "1–19 Employees")
        self.assertEqual(organization.founded_year, 2024)
        self.assertEqual(solution.product_names, ["Revve AI", "Revve Voice"])
        self.assertEqual(solution.segment_focus, ["B2B", "B2B2C"])
        self.assertEqual(solution.built_with, [])
        self.assertEqual(solution.core_technology, source["Core Technology"])
        self.assertEqual(solution.infrastructure_used, "AWS, Google Cloud")
        self.assertEqual(solution.use_case_industries, ["Banking", "FMCG", "FnB"])
        self.assertEqual(solution.use_case_descriptions, source["Use Case Descriptions"])
        self.assertEqual(solution.notable_paying_customers, "EagleView, Rollick.io, VIB")
        self.assertEqual(solution.traction, "US enterprise customers; Vietnam bank proof of concept.")
        self.assertEqual(solution.monetization_model, "Subscription (e.g., SaaS)")
        self.assertEqual(solution.company_funding_status, "Bootstrapped")
        self.assertIsNone(solution.company_funding_raised)
        self.assertEqual(solution.competitors, "11x, Bland, Phonely")


if __name__ == "__main__":
    unittest.main()
