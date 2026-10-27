# TrustCare: Adaptive Multi-Agent Clinical Decision Support System (CDSS)

> **Research Prototype Notice**: TrustCare is an academic research prototype developed as a final-year B.Tech project to evaluate multi-agent retrieval-augmented generation (RAG) and biomedical LLM reasoning on de-identified clinical test cases. It is **not** a certified medical device and must **not** be used for clinical diagnostic or treatment decisions.

---

## 1. Project Overview

TrustCare is an adaptive, multi-agent Clinical Decision Support System that synthesizes unstructured patient clinical narratives, structured biomedical literature (PubMed), real-time guideline evidence, and supervised machine learning into transparent, grounded clinical summaries.

### Core Objectives
1. **Unstructured Narrative Normalization**: Extract demographic and clinical entities (age, sex, symptoms, onset duration, history, vitals) deterministically using rule-based and NLP extractors without fabricating unreported symptoms.
2. **Biomedical Literature Retrieval (RAG)**: Index and retrieve relevant cardiology research from PubMed using dense vector embeddings in Qdrant.
3. **Cardiovascular Risk Stratification**: Evaluate cardiovascular risk using an uncalibrated supervised Logistic Regression model trained on the Cleveland Heart Disease dataset, with transparent flagging of provided versus imputed clinical parameters.
4. **Multi-Agent Evidence Fusion**: Synthesize biomedical reasoning via the specialized open-weight medical language model **BioMistral-7B** with strict anti-hallucination guardrails and dynamic clinical heuristic fallbacks.
5. **Patient Safety & Transparency**: Detect emergency red flags (e.g., severe exertional chest pain radiating to arm/jaw) and issue immediate emergency triage disclaimers.

---

## 2. Multi-Agent Architecture & Pipeline Flow

The backend executes a 6-stage sequential agent pipeline:

```
[Patient Intake (Notes / Vitals)]
           │
           ▼
┌─────────────────────────────────┐
│ 1. Clinical Clarifier Agent     │ ➔ Extracts demographics, symptoms, vitals, durations
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 2. Symptom RAG Analyzer Agent   │ ➔ Dense vector retrieval against 214 PubMed abstracts (Qdrant)
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 3. Evidence Web Scanner Agent   │ ➔ ACC/AHA guideline validation and source credibility tiers
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 4. Cardiac Risk Model (Cleveland│ ➔ Supervised ML probability calculation + imputation audit
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 5. Clinical Data Fusion Agent   │ ➔ BioMistral-7B synthesis + dynamic heuristic grounding
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 6. Adaptive Optimizer Loop      │ ➔ Confidence audit & insufficient evidence flagging
└─────────────────────────────────┘
           │
           ▼
[Interactive Clinical Diagnostic Report]
```

---

## 3. Technology Stack

- **Backend**: Python 3.10+ / 3.13, FastAPI, Uvicorn, Pydantic v2.
- **Frontend**:
  - **Standalone Static UI**: HTML5, CSS3, Vanilla JavaScript (served directly at `/` by FastAPI on port 8000).
  - **Full-featured Web App**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Zustand, Lucide React (located in `frontend/`).
- **Machine Learning**: Scikit-Learn (Logistic Regression, StandardScaler, SimpleImputer), NumPy, Pandas.
- **Vector Database & Embeddings**:
  - **Qdrant**: High-performance vector database (cosine distance, port 6333).
  - **Embedding Model**: `pritamdeka/S-PubMedBert-MS-MARCO` (768-dimensional biomedical sentence embeddings) or `all-MiniLM-L6-v2`.
- **Biomedical LLM**: BioMistral/BioMistral-7B via Hugging Face Inference Providers Router API with deterministic local clinical heuristic fallbacks.
- **External Guidelines**: PubMed API (E-utilities) & Tavily Search API.

---

## 4. Repository Structure

```
trustcare/
├── agents/                       # Specialized AI agent implementations
│   ├── clarifier.py              # Entity extraction & clinical normalization
│   ├── cardiac_model.py          # Cleveland Heart Disease Logistic Regression model
│   ├── clinical_data_fusion.py   # Multi-agent synthesis & BioMistral integration
│   ├── evidence_scanner.py       # Web guideline validator (Tavily/ACC/AHA)
│   └── symptom_rag_analyzer.py   # Vector retrieval over PubMed cardiology corpus
├── data/
│   └── heart_disease/
│       └── processed.cleveland.data # Verified Cleveland Dataset (303 patient records)
├── frontend/                     # Full Next.js 14 App Router dashboard
│   ├── app/                      # App router pages (dashboard, analyze, report)
│   ├── components/               # React components (PatientForm, CardiacRiskPanel, etc.)
│   ├── lib/                      # Zustand store, API clients, and TypeScript types
│   └── package.json              # Frontend npm dependencies
├── static/                       # Static web assets served directly by FastAPI
│   ├── index.html                # TrustCare CDSS single-page user interface
│   ├── style.css                 # Healthcare UI styling and risk gauges
│   └── script.js                 # Interactive form controller & live report renderer
├── tests/
│   └── test_safety.py            # Unit tests for clinical safety & regression guardrails
├── api.py                        # FastAPI REST API wrapper (endpoints & static routes)
├── cardiac_pubmed_abstracts.json # Verified PubMed corpus (214 cardiology abstracts)
├── clinical_utils.py             # Schema validators, heuristics, and formatters
├── config.py                     # Centralized environment configuration
├── embed_and_index.py            # Script to embed and index PubMed abstracts into Qdrant
├── heart_disease_model.py        # Model training and coefficient derivation script
├── pipeline_demo.py              # CLI demo runner for multi-agent synthesis
├── requirements.txt              # Python package dependencies
├── .env.example                  # Template for environment variables (clean placeholders)
├── .gitignore                    # Git ignore file excluding secrets, caches, and node_modules
└── README.md                     # Project documentation
```

---

## 5. Datasets (Verified Counts)

1. **Cleveland Heart Disease Dataset (`data/heart_disease/processed.cleveland.data`)**:
   - **Records**: Exactly 303 patient records.
   - **Features (14)**: Age, Sex, CP (chest pain type), Trestbps (resting BP), Chol (serum cholesterol), FBS (fasting blood sugar), Restecg (resting ECG), Thalach (max heart rate), Exang (exercise angina), Oldpeak (ST depression), Slope, CA (fluoroscopy vessels), Thal (thallium defect), Target (heart disease presence).
2. **Cardiology Literature Corpus (`cardiac_pubmed_abstracts.json`)**:
   - **Articles**: Exactly 214 peer-reviewed abstracts indexed by PubMed ID (PMID), Title, Abstract, and Condition Tag.

---

## 6. Installation & Setup

### Prerequisites
- Python 3.10 to 3.13
- Node.js 18+ (optional, only if running the Next.js app)
- Docker (optional, for Qdrant vector database)

### Step 1: Clone the Repository
```bash
git clone https://github.com/Dhanuvarshini-k/trustcare.git
cd trustcare
```

### Step 2: Set Up Python Environment
```bash
python -m venv venv
# On Windows CMD:
venv\Scripts\activate
# On Linux / macOS:
source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Copy the template file to `.env` and fill in your keys:
```bash
# Windows CMD:
copy .env.example .env
# Linux / macOS:
cp .env.example .env
```
Edit `.env` to configure:
- `HF_TOKEN`: Hugging Face access token.
- `QDRANT_URL`: URL to your Qdrant instance (default: `http://localhost:6333`).
- `TAVILY_API_KEY`: API key for web guideline verification (optional).
- `GEMINI_API_KEY`: Optional fallback reasoning key.

### Step 4 (Optional): Start Qdrant & Index Papers
```bash
# Run Qdrant in Docker:
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant

# Index the 214 PubMed abstracts:
python embed_and_index.py
```

---

## 7. Running the Application

### Option A: Standalone Fast Application (Recommended)
Start the FastAPI backend with embedded static website:
```bash
python -m uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```
Open your browser at:
- **Web UI**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Interactive API Documentation (Swagger)**: [http://127.0.0.1:8000/api/docs](http://127.0.0.1:8000/api/docs)

### Option B: Full Next.js Frontend
In a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 8. Verification & Testing

Run safety and regression tests:
```bash
python -m unittest discover -s tests -v
```

Execute CLI pipeline verification:
```bash
python pipeline_demo.py
```

---

## 9. Ethical & Clinical Disclaimers

1. **Experimental Prototype**: TrustCare is designed for research, benchmarking, and demonstration purposes only.
2. **Anti-Hallucination Guardrails**: Unreported patient symptoms are never inferred, hallucinated, or added to diagnostic summaries.
3. **Transparent Imputation**: Any missing clinical examination values (e.g., ECG, troponin, angiograms) are imputed via cohort medians and explicitly flagged as "Assumed Baseline (Not Provided)" in both the UI and API response.
4. **Emergency Triage**: Patients presenting with potential acute coronary syndromes or red-flag cardiac symptoms are prompted to seek emergency medical care immediately.
