# Professional Healthcare UI/UX Design System
## TB Federated Learning & AI-Assisted Chest X-Ray Platform

### Overview & Visual Identity
The platform has been redesigned into a **modern hospital-grade healthcare SaaS platform** that communicates **trust, medical professionalism, clinical reliability, and strict privacy protection**.

---

## 1. Color Palette & Exact Design Tokens

| Token Role | Hex Code | Purpose & Application |
| :--- | :--- | :--- |
| **Primary (Medical Blue)** | `#2563EB` | Main CTAs, "START FEDERATED LEARNING ROUND", active navigation, progress indicators |
| **Primary Hover** | `#1E40AF` | Button hover states, focused controls |
| **Secondary (Healthcare Teal)** | `#0D9488` | Privacy badges, DP-SGD indicators, activation highlights (used selectively) |
| **Main Background** | `#F8FAFC` | Spacious, calm clinical canvas across all pages |
| **Card / Surface** | `#FFFFFF` | Workspaces, tables, modals, sidebars, metrics cards |
| **Primary Text** | `#0F172A` | Major headings, critical metrics, patient IDs, model versions |
| **Secondary Text** | `#64748B` | Clinical descriptions, metadata, timestamps, helper text |
| **Success** | `#16A34A` / `#F0FDF4` | Connected nodes, verified cases, completed rounds |
| **Warning** | `#F59E0B` / `#FFFBEB` | Training in progress, pending clinician sign-off |
| **Error** | `#DC2626` / `#FEF2F2` | Disconnected nodes, failed transfers, critical alerts |
| **Border** | `#E2E8F0` | Thin, crisp structural borders (no harsh black borders) |

---

## 2. Application Layout & Navigation Hierarchy

### 2.1 Minimal Top Navigation Bar
- **Left**: Dynamic Page Title (e.g. `Federated Learning Operations`, `Clinical Radiography Workspace`) & Breadcrumbs.
- **Right**:
  - `● System Healthy` live badge (`#F0FDF4` / `#16A34A`)
  - `🔒 Data Kept Local` privacy badge (`#F0FDFA` / `#0D9488`)
  - Hospital Organization Label (`Central FL Aggregation Hub` / `Hospital A — Urban Referral`)
  - Notification bell with unread indicator
  - User avatar chip with role badge (`Admin`, `Doctor`, `Patient`) and account switcher

### 2.2 White Clinical Sidebar with Role-Based Navigation
- **Surface**: Clean `#FFFFFF` with `#E2E8F0` thin right border.
- **Active State**: Medical Blue `#2563EB` text and `#EFF6FF` background.
- **Role-Based Menus**:
  - **Central Admin**: Overview, Federated Learning, FL Rounds, Hospital Nodes, Global Models, Training Metrics, Security, Audit Logs, Settings
  - **Doctor**: Dashboard, Patients, New CXR Analysis, Pending Reviews, AI Reports, Active Learning, History, Profile
  - **Patient**: Dashboard, My Reports, My X-Rays, Appointments, Privacy, Profile
- **Persistent Guarantee**: Unobtrusive footer card reminding: *"Patient images remain within hospital nodes. Only model updates are shared."*

---

## 3. Federated Learning Operations Dashboard (Admin)

### 3.1 Top Metrics Bar
1. **Global Model**: `v2.1` / `v2` (ResNet-18)
2. **Current Round**: `#1` / `#18` (FedAvg)
3. **Connected Nodes**: `2 / 2` (`● All nodes online`)
4. **Model Status**: `● Ready` (Validation accuracy: `86.8%`)

### 3.2 Primary Master CTA
- Prominent **`START FEDERATED LEARNING ROUND`** button in `#2563EB`.

### 3.3 Central FL Architecture Diagram
A clean, spacious clinical topology diagram visualizing:
$$\text{Central Server (v2.1)} \xrightarrow{\text{Distribute}} \text{Hospitals A \& B} \xrightarrow{\text{Opacus DP-SGD}} \text{Model Updates (11.2 MB)} \xrightarrow{\text{FedAvg}} \text{Global Model (v2.2)}$$
- Blue (`#2563EB`) for model flow
- Teal (`#0D9488`) for privacy / DP-SGD
- Green (`#16A34A`) for aggregated weights

### 3.4 Node Cards (Hospitals A & B)
Standardized cards displaying:
- Node Name & ID
- Connection Status (`● Connected`)
- Local Model Version (`v2.1`)
- Local Isolated Dataset (`120 CXRs`)
- Real-time Loss (`0.42`), Accuracy (`86.4%`), and DP-SGD Status (`✓ Enabled`)

### 3.5 Security Status & Model Registry Tables
- Security card confirming TLS/mTLS, Node Authentication, DICOM Sanitization, DP-SGD, and Secure Transfer.
- White table design with light `#E2E8F0` borders, generous padding, and small badges.

---

## 4. Clinician Workspace & AI Screening UI (Doctor)

### 4.1 Header & Triage Metrics
- Header: *"Good morning, Dr. Jenkins — Review AI-assisted TB screening cases requiring clinical attention."*
- Metrics: **Pending Reviews** (`08`), **Today's Scans** (`24`), **TB Positive Findings** (`05`), **AI Screened Cases** (`42`).
- Primary CTA: **`+ New CXR Analysis`**.

### 4.2 Radiograph & Explainable AI Workspace
- **Top Patient Bar**: Patient Identifier, PA/AP view, Safe Harbor de-identification status, priority.
- **Grad-CAM Tabs**:
  - `[ Original ]`: Unaltered chest radiograph.
  - `[ Heatmap ]`: Raw convolutional feature map activation.
  - `[ Overlay ]`: Combined view with opacity slider ($10\% - 100\%$).
- **Explainability Details**: Highlighted Region (*Upper Lung Field / Apical Zone*), Model Architecture (*ResNet-18 v2.1*), activation scale.
- **Clinical Disclaimer**: *"AI attention visualization. Not a definitive indication of pathology."*

### 4.3 Clinician Review & Sign-Off Panel
- AI Screening result echo: `TB Positive (94.2% confidence)`.
- Clinical decision radio options:
  - `○ Confirm AI Result`
  - `○ Override AI Result` (with dropdown for correct diagnosis)
- Textarea for clinical notes and radiologist observations.
- Medical Blue CTA: `[ Confirm Review ]` sending verification to `POST /feedback`.

---

## 5. Patient Health Portal (Patient)

- Simplified, human-friendly presentation without technical ML jargon.
- **My Health Status**: *"Requires Clinical Review"* or *"Verified Normal"*.
- Medical Reports and Upcoming Doctor Appointments.
- Daily Medication Adherence tracker (Morning / Afternoon / Evening doses).
- Clear privacy statement assuring patient data remains strictly in the local hospital.

---

## 6. Clinical & Professional AI Terminology Standards

| Disapproved Jargon | Standardized Clinical Language |
| :--- | :--- |
| "AI Diagnosis" | **"AI-assisted TB screening"** |
| "Confirmed diagnosis" | **"Model prediction" / "Clinical verification"** |
| "Definitely TB" | **"Suspicious features requiring clinical review"** |
| "AI Doctor" | **"Diagnostic Decision Support"** |
