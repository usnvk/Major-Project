# Implementation Report

## Implemented

- Native ResNet-18 and public TB-specific DenseNet-121/PyTorch TB checkpoint support.
- Chest X-ray preprocessing, TB Normal/TB classification, confidence scores, and DenseNet Grad-CAM.
- Real SQLite persistence for predictions, feedback, patient visits, follow-ups, hospitals, users, and audit events.
- Chronological patient timeline and previous/current visit comparison.
- Doctor review of AI findings and clinician-assessed improved/unchanged/worsened progress.
- Hospital role and hospital workspace.
- Two-hospital model parameter exchange, sample-weighted FedAvg aggregation, versioned checkpoints, and redistribution.
- Live hospital heartbeat/node status and real round event polling.
- Removal of random training progress, random predictions, and random accuracy fallback values from federated and patient workflows.

## Model Evaluation

The public native DenseNet-121 checkpoint was evaluated on 100 held-out Kaggle Normal images and 100 held-out Kaggle TB images:

| Metric | Result |
|---|---:|
| Accuracy | 77.0% |
| Precision | 90.91% |
| Recall/Sensitivity | 60.0% |
| F1-score | 72.29% |
| ROC-AUC | 78.95% |
| Confusion matrix | TN=94, FP=6, FN=40, TP=60 |
| Operating threshold | 0.15 |

This is measured performance on a small independent holdout, not a clinical validation result.

A quick Kaggle fine-tuning attempt with a frozen pretrained backbone reached 17.46% holdout accuracy and was not promoted.

## Federated Learning

The demonstration implementation now exchanges complete local PyTorch state dictionaries. The central server:

1. Requires live Hospital A and Hospital B heartbeats.
2. Requires real parameter tensors from both hospitals.
3. Validates tensor names and shapes.
4. Performs sample-count-weighted FedAvg.
5. Saves a versioned checkpoint.
6. Copies the raw state dict to the active inference checkpoint.

Raw X-ray images and identifiable patient records are not included in FL update payloads.

## Remaining Limitations

- A full external Flower gRPC process on three physically separate machines still requires LAN setup and final network testing.
- The public DenseNet model is screening assistance only and needs prospective clinical validation.
- Grad-CAM highlights model attention and is not a lesion diagnosis.
- DP-SGD integration requires the Opacus private loader to be attached to the hospital training loop on a real run.
- Follow-up and hospital registration APIs are implemented; broader admin UI sections should be added incrementally.

## Verification

- Python backend compilation passed.
- Frontend production build passed.
- Native PTH model inference passed.
- DenseNet Grad-CAM returned a real data URI and positive bounding-box result.
- Hospital and follow-up SQLite CRUD passed.
- Hospital role registration passed.
- Two-node tensor aggregation passed locally and saved `federated_model_v2.pth`.
