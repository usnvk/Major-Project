# Existing TB Model Directory

Place your pre-trained Tuberculosis model checkpoint in this directory as:
  `tb_resnet18.pth`

Alternatively, the inference pipeline (`inference.py`) automatically falls back to checking:
  - `centralized_model.pth` (in root directory)
  - `federated_model.pth` (in root directory)

Do NOT overwrite or replace your existing model checkpoint.
