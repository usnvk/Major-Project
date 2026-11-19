# 🫁 PulmoScan: Privacy-Preserving Federated Learning for Tuberculosis Disease Prediction

A complete clinical AI decision support system and multi-hospital Federated Learning platform for pulmonary Tuberculosis (TB) screening, disease staging, and Grad-CAM++ feature explainability.

---

## 🚀 Quick Documentation Links

- **📖 [Complete End-to-End Demonstration Guide](DEMO_GUIDE.md):** Step-by-step visual runbook covering user login creation, CXR radiograph ingestion, Grad-CAM++ heatmaps, clinician feedback, and all 3 Federated Learning execution modes.
- **💻 [Three-Laptop Physical LAN Guide](THREE_LAPTOP_FL_GUIDE.md):** Configuration manual for demonstrating real multi-machine decentralized edge training across 3 physical laptops over Wi-Fi.
- **🎨 [Healthcare Design System Specification](HEALTHCARE_DESIGN_SYSTEM.md):** Complete enterprise medical design tokens, WCAG AA accessibility rules, and color palettes.

---

## ⚡ Quickstart Commands

### 1. Start Central Backend API
```powershell
cd Major-Project/backend
python -m uvicorn main:app --reload --port 8000
```
Swagger API documentation available at: `http://localhost:8000/docs`

### 2. Start Clinical Frontend Dashboard
```powershell
cd Major-Project/Frontend
npm run dev
```
Web Application accessible at: `http://localhost:5173`

### 3. Run Automated System Test Suite (All 5 Stages)
```powershell
cd Major-Project
python test_end_to_end.py
```

---

## 🔑 Default System Access

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@pulmoscan.org` | `AdminPass123!` | FL Cluster Telemetry, Aggregation Controls, HIPAA Audit Trail |
| **Clinicians & Patients** | Registered via UI | Set by user | Role-isolated workspaces & clinical review queue |

---

## 🏗️ 5-Stage Clinical AI Pipeline

1. **Stage 1: HIPAA Safe Harbor De-Identification:** Strips 18 PHI tags from DICOM metadata and computes SHA-256 patient pseudonyms.
2. **Stage 2: Out-Of-Distribution (OOD) Gatekeeper:** ResNet-18 classifier rejects non-medical or blank images before diagnostic processing.
3. **Stage 3: Privacy-Preserving Federated Learning:** FedProx with Opacus DP-SGD ($\varepsilon, \delta$) and Flower gRPC transport.
4. **Stage 4: TB Diagnosis & Grad-CAM++ Localization:** Classifies normal vs. TB pulmonary infiltrates with lesion heatmaps and bounding boxes.
5. **Stage 5: Clinician Sign-Off & Active Learning Loop:** Physician reviews are logged into SQLite and queued for the next edge retraining round.

---

## Public Pretrained TB Model & Demo Datasets

The diagnostic backend integrates a free public pretrained chest-X-ray model:

- **Model:** [Ressshh BioMedCLIP-Distilled DenseNet-121 for Pulmonary Tuberculosis Conformal Triage](https://huggingface.co/Ressshh/tb-conformal-distilled-densenet121)
- **Model file:** `backend/models/tb_public.onnx`
- **License:** MIT
- **Architecture:** DenseNet-121, binary Normal/Tuberculosis output
- **Published external-cohort AUROC:** 0.9065–0.9347 across the model card's external cohorts
- **Operating threshold:** 0.4401 TB probability

The project does **not** claim that this pretrained model was trained locally. It is loaded as a third-party screening model and is supplemented by this project's chest-X-ray validator and clinical UI.

Public datasets suitable for demonstrations:

- **Montgomery County CXR Set:** 138 PA chest X-rays, 80 normal and 58 TB-positive, from the US National Library of Medicine. Filename suffix `0` is normal and `1` is TB-positive.
- **Tawsifur Rahman TB Chest X-ray Database:** 4,200 publicly accessible images, including 700 TB-positive and 3,500 normal images.
- **Montgomery and Shenzhen public CXR datasets:** Sources used by this project's downloadable demonstration preparation workflow.

These datasets are sources for demonstration and testing. AI findings must remain clinician-reviewed decision support, not a standalone diagnosis.
