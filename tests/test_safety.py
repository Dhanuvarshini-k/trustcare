import unittest
from clinical_utils import normalize_clinical_data, is_cardiac_query, parse_json_object
from agents.clinical_data_fusion import fuse
from agents.symptom_rag_analyzer import build_query_text

class SafetyTests(unittest.TestCase):
    def test_unrelated_vision_query_not_cardiac(self):
        self.assertFalse(is_cardiac_query("sudden painless left eye vision loss"))

    def test_chest_discomfort_is_cardiac_routed(self):
        self.assertTrue(is_cardiac_query("chest discomfort and shortness of breath"))

    def test_missing_fields_normalized(self):
        data = normalize_clinical_data({"symptoms": "chest pain"})
        self.assertEqual(data["symptoms"], ["chest pain"])
        self.assertEqual(data["lab_results"], [])

    def test_raw_input_fallback_when_clarifier_has_no_structured_fields(self):
        text = "Fictional case: chest discomfort and shortness of breath."
        self.assertEqual(build_query_text({"raw_input": text}), text)

    def test_parse_fenced_json(self):
        self.assertEqual(parse_json_object('```json\n{"ok": true}\n```'), {"ok": True})

    def test_fusion_never_reports_numeric_confidence(self):
        result = fuse({"diagnoses": [], "retrieved_evidence": []},
                      {"web_evidence_summary": []},
                      {"raw_input": "chest discomfort", "symptoms": ["chest discomfort"]})
        self.assertIsNone(result["overall_confidence"])
        self.assertFalse(result["meets_threshold"])
        self.assertTrue(result["insufficient_evidence"])
        self.assertTrue(result["emergency_guidance"])

    def test_pipeline_surfaces_rag_stage_error(self):
        result = fuse({"diagnoses": [], "retrieved_evidence": [],
                       "error": "Qdrant collection 'cardiac_abstracts' does not exist."},
                      {"web_evidence_summary": []}, {})
        self.assertIn("rag", result["stage_errors"])
        self.assertIn("cardiac_abstracts", result["stage_errors"]["rag"])

if __name__ == "__main__":
    unittest.main()
