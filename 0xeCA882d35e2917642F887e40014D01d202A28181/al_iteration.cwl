cwlVersion: v1.2
class: CommandLineTool

label: Active Learning Iteration (Train + Query)
doc: One-step AL iteration using modAL and scikit-learn, returns actual query samples.

baseCommand: python3
arguments: [../../al_iteration.py]

inputs:
  labeled_data:
    type: File
    inputBinding:
      prefix: --labeled_data
    doc: Initial labeled dataset file (CSV or NPY format)
  labeled_labels:
    type: File
    inputBinding:
      prefix: --labeled_labels
    doc: Initial labels file (CSV or NPY format)
  unlabeled_data:
    type: File
    inputBinding:
      prefix: --unlabeled_data
    doc: Unlabeled data pool for querying (CSV or NPY format)
  model_in:
    type: File?
    inputBinding:
      prefix: --model_in
    doc: Pre-trained model from previous iteration (optional)
  config:
    type: File
    inputBinding:
      prefix: --config
    doc: AL configuration file with parameters

outputs:
  model_out:
    type: File
    outputBinding:
      glob: output/model/model_round_*.pkl
    doc: Updated model after training with new labels
  query_samples:
    type: File
    outputBinding:
      glob: output/query_samples.json
    doc: JSON file containing the actual samples selected for labeling.

requirements:
  DockerRequirement:
    dockerPull: python:3.9-slim
  