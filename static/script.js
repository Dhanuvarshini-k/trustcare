// TrustCare CDSS Interactive Controller
document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const intakeSection = document.getElementById("intake-section");
  const progressSection = document.getElementById("progress-section");
  const reportSection = document.getElementById("report-section");
  const intakeForm = document.getElementById("intake-form");
  const clinicalNotes = document.getElementById("clinical-notes");
  const notesCharCount = document.getElementById("notes-char-count");
  const btnLoadExample = document.getElementById("btn-load-example");
  const btnSubmit = document.getElementById("btn-submit");
  const formError = document.getElementById("form-error");
  const btnNewAnalysis = document.getElementById("btn-new-analysis");

  // Cardiac Parameters Toggle
  const toggleCardiacParams = document.getElementById("toggle-cardiac-params");
  const parametersGrid = document.getElementById("parameters-grid");
  const toggleParamsView = document.getElementById("toggle-params-view");
  const paramsToggleText = document.getElementById("params-toggle-text");

  // Example case constants
  const EXAMPLE_NOTE = `Fictional test case: 58-year-old male presenting with exertional chest tightness radiating to the left arm, onset 3 weeks ago. History of hypertension (on lisinopril), hyperlipidaemia, and a 20 pack-year smoking history (quit 5 years ago). Resting BP 148/92 mmHg, serum cholesterol 220 mg/dL. No ECG, troponin, or imaging results provided.`;

  // 1. Character count update
  clinicalNotes.addEventListener("input", () => {
    const len = clinicalNotes.value.trim().length;
    notesCharCount.textContent = `${len} character${len === 1 ? "" : "s"}`;
    if (formError.style.display !== "none") {
      formError.style.display = "none";
    }
  });

  // 2. Cardiac Parameters Toggle Handling
  toggleCardiacParams.addEventListener("change", (e) => {
    if (e.target.checked) {
      parametersGrid.style.display = "grid";
      toggleParamsView.style.display = "inline-flex";
      paramsToggleText.textContent = "Collapse";
    } else {
      parametersGrid.style.display = "none";
      toggleParamsView.style.display = "none";
    }
  });

  toggleParamsView.addEventListener("click", () => {
    if (parametersGrid.style.display === "none") {
      parametersGrid.style.display = "grid";
      paramsToggleText.textContent = "Collapse";
    } else {
      parametersGrid.style.display = "none";
      paramsToggleText.textContent = "Expand";
    }
  });

  // 3. Load Example
  btnLoadExample.addEventListener("click", () => {
    clinicalNotes.value = EXAMPLE_NOTE;
    notesCharCount.textContent = `${EXAMPLE_NOTE.length} characters`;

    toggleCardiacParams.checked = true;
    parametersGrid.style.display = "grid";
    toggleParamsView.style.display = "inline-flex";
    paramsToggleText.textContent = "Collapse";

    document.getElementById("param-age").value = 58;
    document.getElementById("param-sex").value = "1";
    document.getElementById("param-cp").value = "0";
    document.getElementById("param-trestbps").value = 148;
    document.getElementById("param-chol").value = 220;
    document.getElementById("param-fbs").value = "0";
    document.getElementById("param-restecg").value = "1";
    document.getElementById("param-thalach").value = 142;
    document.getElementById("param-exang").value = "1";
    document.getElementById("param-oldpeak").value = "2.3";
    document.getElementById("param-slope").value = "1";
    document.getElementById("param-ca").value = "1";
    document.getElementById("param-thal").value = "7";

    formError.style.display = "none";
  });

  // 4. Form Submission and Multi-Agent Execution
  intakeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rawText = clinicalNotes.value.trim();
    const includeCardiac = toggleCardiacParams.checked;

    const cardiacParams = {};
    const paramFields = [
      "age", "sex", "cp", "trestbps", "chol", "fbs",
      "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"
    ];

    let hasAnyParamValue = false;
    for (const key of paramFields) {
      const el = document.getElementById(`param-${key}`);
      if (el && el.value !== "") {
        cardiacParams[key] = parseFloat(el.value);
        hasAnyParamValue = true;
      }
    }

    if (!rawText && !hasAnyParamValue) {
      formError.textContent = "Missing required patient details! Please enter clinical notes or heart parameters before starting analysis.";
      formError.style.display = "block";
      clinicalNotes.focus();
      return;
    }

    formError.style.display = "none";
    btnSubmit.disabled = true;

    // Show Progress Section
    progressSection.style.display = "block";
    reportSection.style.display = "none";
    progressSection.scrollIntoView({ behavior: "smooth" });

    // Reset step badges
    const stepIds = ["clarifier", "rag_analyzer", "evidence_scanner", "cardiac_model", "data_fusion", "adaptive_optimizer"];
    stepIds.forEach((s) => {
      const el = document.getElementById(`step-${s}`);
      if (el) {
        el.className = "agent-step-item";
        el.querySelector(".step-status").textContent = "Pending";
      }
    });

    // Simulate active agent steps for visual feedback while waiting for API
    let stepIdx = 0;
    const progressInterval = setInterval(() => {
      if (stepIdx < stepIds.length) {
        const currId = stepIds[stepIdx];
        const prevId = stepIdx > 0 ? stepIds[stepIdx - 1] : null;
        if (prevId) {
          const prevEl = document.getElementById(`step-${prevId}`);
          if (prevEl) {
            prevEl.className = "agent-step-item done";
            prevEl.querySelector(".step-status").textContent = "Completed";
          }
        }
        const currEl = document.getElementById(`step-${currId}`);
        if (currEl) {
          currEl.className = "agent-step-item running";
          currEl.querySelector(".step-status").textContent = "Running...";
        }
        stepIdx++;
      }
    }, 400);

    const payload = {
      raw_text: rawText,
      cardiac_params: includeCardiac || hasAnyParamValue ? cardiacParams : null,
      age: cardiacParams.age !== undefined ? cardiacParams.age : null,
      sex: cardiacParams.sex !== undefined ? cardiacParams.sex : null,
      cp: cardiacParams.cp !== undefined ? cardiacParams.cp : null,
      trestbps: cardiacParams.trestbps !== undefined ? cardiacParams.trestbps : null,
      chol: cardiacParams.chol !== undefined ? cardiacParams.chol : null,
      exang: cardiacParams.exang !== undefined ? cardiacParams.exang : null,
    };

    try {
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${response.status}: Failed to run diagnostic pipeline.`);
      }

      const result = await response.json();

      clearInterval(progressInterval);
      // Mark all done
      stepIds.forEach((s) => {
        const el = document.getElementById(`step-${s}`);
        if (el) {
          el.className = "agent-step-item done";
          el.querySelector(".step-status").textContent = "Done";
        }
      });

      // Render Report
      setTimeout(() => {
        renderReport(result);
        progressSection.style.display = "none";
        reportSection.style.display = "flex";
        btnSubmit.disabled = false;
        reportSection.scrollIntoView({ behavior: "smooth" });
      }, 500);

    } catch (err) {
      clearInterval(progressInterval);
      btnSubmit.disabled = false;
      progressSection.style.display = "none";
      formError.textContent = `Analysis error: ${err.message}`;
      formError.style.display = "block";
    }
  });

  // 5. Render Diagnostic Report Output
  function renderReport(data) {
    const clarified = data.clarified_data || {};
    const demo = clarified.demographics || {};
    const cardiac = data.cardiac_risk || {};
    const fused = data.fused_output || {};
    const rag = data.rag_output || {};
    const traces = data.agent_traces || [];

    // Demographics
    const ageVal = demo.age !== undefined && demo.age !== null ? demo.age : (cardiac.input_parameters?.age ?? "Unspecified");
    const sexVal = demo.gender || (cardiac.input_parameters?.sex === 1 ? "Male" : cardiac.input_parameters?.sex === 0 ? "Female" : "Unspecified");
    document.getElementById("report-age-sex").textContent = `${ageVal} / ${sexVal}`;

    document.getElementById("report-duration").textContent = clarified.duration || "Unspecified";

    const symptomsList = clarified.symptoms && clarified.symptoms.length > 0 
      ? clarified.symptoms.join(", ") 
      : "None reported";
    document.getElementById("report-symptoms").textContent = symptomsList;

    const rawNote = clarified.raw_input || clinicalNotes.value.trim();
    const rawNoteEl = document.getElementById("report-raw-note");
    if (rawNote) {
      rawNoteEl.textContent = `"${rawNote}"`;
      rawNoteEl.style.display = "block";
    } else {
      rawNoteEl.style.display = "none";
    }

    // Emergency Guidance Banner
    const emergencyList = fused.emergency_guidance || [];
    const emergencyBanner = document.getElementById("report-emergency-banner");
    const emergencyListEl = document.getElementById("report-emergency-list");
    if (emergencyList.length > 0) {
      emergencyListEl.innerHTML = emergencyList.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
      emergencyBanner.style.display = "flex";
    } else {
      emergencyBanner.style.display = "none";
    }

    // Cardiac ML Risk
    const probVal = cardiac.probability !== null && cardiac.probability !== undefined 
      ? (cardiac.probability > 1 ? cardiac.probability : cardiac.probability * 100) 
      : null;
    const probText = probVal !== null ? `${probVal.toFixed(1)}%` : "N/A";
    document.getElementById("report-risk-percentage").textContent = probText;

    const riskBadge = document.getElementById("report-risk-badge");
    const level = cardiac.risk_level || "Unknown";
    riskBadge.textContent = `${level} Risk`;
    riskBadge.className = `badge badge-lg ${
      level === "High" ? "badge-danger" : level === "Moderate" ? "badge-warning" : "badge-success"
    }`;

    // Missing Tests Notice
    const missingTests = cardiac.missing_tests || [];
    const missingSummaryEl = document.getElementById("report-missing-summary");
    const missingTagsEl = document.getElementById("report-missing-tags");
    if (cardiac.missing_clinical_tests_summary) {
      missingSummaryEl.textContent = cardiac.missing_clinical_tests_summary;
    }
    if (missingTests.length > 0) {
      missingTagsEl.innerHTML = missingTests.map((t) => `<span class="missing-tag">${escapeHtml(t)}</span>`).join("");
    } else {
      missingTagsEl.innerHTML = `<span class="missing-tag" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;">All parameters directly provided</span>`;
    }

    // Parameters Provenance Table
    const tbody = document.getElementById("report-params-tbody");
    tbody.innerHTML = "";
    const featureDetails = cardiac.feature_details || {};
    const inputParams = cardiac.input_parameters || {};

    const keys = Object.keys(featureDetails).length > 0 ? Object.keys(featureDetails) : Object.keys(inputParams);
    if (keys.length > 0) {
      keys.forEach((key) => {
        const meta = featureDetails[key] || {};
        const val = meta.value !== undefined ? meta.value : inputParams[key];
        const isImputed = meta.is_imputed !== undefined ? meta.is_imputed : (val === null || val === undefined);
        const name = meta.feature_name || key.toUpperCase();
        const category = meta.category || "General";
        const unit = meta.unit ? ` ${meta.unit}` : "";

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${escapeHtml(name)}</strong></td>
          <td>${escapeHtml(category)}</td>
          <td><strong>${val !== null && val !== undefined ? escapeHtml(String(val)) + escapeHtml(unit) : "—"}</strong></td>
          <td>
            <span class="provenance-tag ${isImputed ? "prov-imputed" : "prov-provided"}">
              ${isImputed ? "Assumed Baseline (Not Provided)" : "Directly Provided"}
            </span>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // BioMistral Synthesis Narrative
    const biomistralText = fused.biomistral_analysis || fused.confidence_note || "Biomedical reasoning synthesis complete.";
    document.getElementById("report-biomistral-text").textContent = biomistralText;

    // Diagnoses List
    const diagnoses = fused.final_diagnoses || [];
    const diagListEl = document.getElementById("report-diagnoses-list");
    document.getElementById("report-candidates-count").textContent = `${diagnoses.length} Candidate${diagnoses.length === 1 ? "" : "s"} Identified`;

    if (diagnoses.length > 0) {
      diagListEl.innerHTML = diagnoses.map((d) => `
        <div class="diagnosis-item">
          <div class="diagnosis-top">
            <span class="diagnosis-name">${escapeHtml(d.condition || "Clinical Condition")}</span>
            <span class="badge ${d.confidence >= 0.7 ? "badge-danger" : d.confidence >= 0.4 ? "badge-warning" : "badge-secondary"}">
              ${d.confidence ? `${Math.round(d.confidence > 1 ? d.confidence : d.confidence * 100)}% Match` : "Candidate"}
            </span>
          </div>
          <p class="diagnosis-status">${escapeHtml(d.status || d.reasoning || "Clinical differential consideration.")}</p>
        </div>
      `).join("");
    } else {
      diagListEl.innerHTML = `<p class="form-hint">No candidate differential conditions identified.</p>`;
    }

    // Literature Evidence (PubMed)
    const evidenceListEl = document.getElementById("report-evidence-list");
    const retrieved = rag.retrieved_evidence || [];
    if (retrieved.length > 0) {
      evidenceListEl.innerHTML = retrieved.map((ev) => `
        <div class="evidence-item">
          <a href="${escapeHtml(ev.url || `https://pubmed.ncbi.nlm.nih.gov/${ev.pmid}/`)}" target="_blank" rel="noopener noreferrer" class="evidence-title">
            ${escapeHtml(ev.title || "Clinical Study Reference")} ↗
          </a>
          <p class="evidence-abstract">${escapeHtml(ev.abstract || "")}</p>
          <div class="evidence-meta">PMID: ${escapeHtml(ev.pmid || "N/A")} • Condition: ${escapeHtml(ev.condition_tag || "Cardiovascular")}</div>
        </div>
      `).join("");
    } else {
      evidenceListEl.innerHTML = `<p class="form-hint">No literature evidence retrieved.</p>`;
    }

    // Agent Traces
    const tracesGrid = document.getElementById("report-traces-grid");
    tracesGrid.innerHTML = "";
    let totalMs = 0;
    traces.forEach((tr) => {
      const ms = tr.duration_ms || 0;
      totalMs += ms;
      const div = document.createElement("div");
      div.className = "trace-item";
      div.innerHTML = `
        <span class="trace-name">${escapeHtml(tr.agent || "Agent")}</span>
        <span class="trace-ms">${ms} ms</span>
        <span class="badge ${tr.status === "done" ? "badge-success" : tr.status === "error" ? "badge-danger" : "badge-secondary"}" style="font-size:0.6rem;padding:2px 6px;">
          ${escapeHtml(tr.status || "completed")}
        </span>
      `;
      tracesGrid.appendChild(div);
    });
    document.getElementById("report-total-duration").textContent = `Total Pipeline: ${totalMs} ms`;
  }

  // 6. New Analysis Reset
  btnNewAnalysis.addEventListener("click", () => {
    reportSection.style.display = "none";
    progressSection.style.display = "none";
    intakeSection.style.display = "block";
    clinicalNotes.value = "";
    notesCharCount.textContent = "0 characters";
    intakeForm.reset();
    parametersGrid.style.display = "none";
    toggleParamsView.style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  function escapeHtml(str) {
    if (typeof str !== "string") return String(str);
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
});
