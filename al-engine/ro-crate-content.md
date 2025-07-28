# RO-Crate content

### **1. al_iteration.cwl**

```solidity
cwlVersion: v1.2
class: CommandLineTool

label: Active Learning Iteration (Train + Query)
doc: One-step AL iteration using modAL and scikit-learn

baseCommand: python3
arguments: [al_iteration.py]

inputs:
  labeled_data:
    type: File
    inputBinding:
      prefix: --labeled_data
  labeled_labels:
    type: File
    inputBinding:
      prefix: --labeled_labels
  unlabeled_data:
    type: File
    inputBinding:
      prefix: --unlabeled_data
  model_in:
    type: File?
    inputBinding:
      prefix: --model_in
  config:
    type: File
    inputBinding:
      prefix: --config

outputs:
  model_out:
    type: File
    outputBinding:
      glob: model/model_round_*.pkl
  query_indices:
    type: File
    outputBinding:
      glob: query_indices.npy

requirements:
  DockerRequirement:
    dockerPull: python:3.9-slim
```

**AL-Engine:**

- **Runs** a Python script `al_iteration.py`
- Dynamically names model files (`model_round_{n}.pkl`)
- saves query indices like this: `np.save('query_indices.npy', query_idx)`
- Updates labeled dataset with newly labeled samples
- Initializes model if none exists (based on config)

```yaml
if args.model_in:
    # Use provided trained model
    learner = joblib.load(args.model_in)
else:
    # Build model from config
    model_type = config["model_type"]
    training_args = config.get("training_args", {})

    if model_type == "LogisticRegression":
        model = LogisticRegression(**training_args)
    elif model_type == "SVC":
        model = SVC(**training_args)
    # ...
    learner = ActiveLearner(estimator=model, query_strategy=chosen_strategy)

```

- Uses config for AL settings (model, strategy, query batch size, etc.)
- Saves outputs in appropriate folders (e.g., `model/`)
- **CWL file itself does not need to hardcode any exact filenames or paths**.
- Instead, those are provided **at runtime via the input object (e.g., `inputs.yml`)**, which maps user-supplied files to the CWL-defined input names, as shown below:
    
    In the CWL file:
    
    ```yaml
    inputs:
      labeled_data:
        type: File
        inputBinding:
          position: 1
          prefix: --labeled_data
    
    ```
    
    - This just defines a *placeholder* for an input file. The actual input file:

### **2. inputs.yml**
- <contract-address> should be replaced by actual contract adress

```yaml
# inputs.yml - Runtime input mapping for al_iteration.cwl

# Labeled training data (required)
labeled_data:
  class: File
  path: al-engine/ro-crates/<contract-address>/inputs/datasets/labeled_samples.npy

# Labels for the labeled data (required)
labeled_labels:
  class: File
  path: al-engine/ro-crates/<contract-address>/inputs/datasets/labeled_targets.npy

# Unlabeled data pool for querying (required)
unlabeled_data:
  class: File
  path: al-engine/ro-crates/<contract-address>/inputs/datasets/unlabeled_samples.npy

# Pre-trained model from previous iteration (optional - only for rounds > 1)
model_in:
  class: File
  path: al-engine/ro-crates/<contract-address>/config/model/model_round_2.pkl

# Configuration file with AL parameters (required)
config:
  class: File
  path: al-engine/ro-crates/<contract-address>/config/config.json
```

### **3. Config.json**

```solidity
{
  "al_scenario": "pool_based",
  "query_strategy": "uncertainty_sampling",
  "model_type": "LogisticRegression",
  "training_args": {
    "max_iter": 1000,
    "random_state": 42
  },
  "label_space": ["setosa", "versicolor", "virginica"],
  "query_batch_size": 2,
  "validation_split": 0.2
}

```