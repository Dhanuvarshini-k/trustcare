import json
from graph.pipeline import run_pipeline

if __name__ == "__main__":
    fictional_case = """
    Fictional test case: 58-year-old adult with chest discomfort,
    shortness of breath, and a history of hypertension.
    No ECG, laboratory results, or imaging findings provided.
    """
    print(json.dumps(run_pipeline(fictional_case), indent=2, ensure_ascii=False))
