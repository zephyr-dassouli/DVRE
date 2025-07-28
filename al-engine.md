# DAL AL-Engine Design Holistic View

- AL-Engine is responsible for handling training and querying
- uses its own **cwltool** for it
- receives necessary files (shown below in folder structure) when project gets deployed
- folder structure:
    
    ```solidity
    al-engine/
    │
    ├── al_iteration.py              # Core training + query script
    ├── main.py                      # Entrypoint for engine
    ├── orchestrator_client.py       # Handles communication with orchestrator - dont need this for local computation (our case)
    ├── workflow_runner.py           # Executes cwltool workflows
    ├── requirements.txt
    └── Dockerfile                   # (optional)
    ```
    

AL_iteration.py

```solidity
# al_iteration.py

import argparse
import joblib
import numpy as np
import os
import json
from sklearn.linear_model import LogisticRegression
from modAL.models import ActiveLearner
from modAL.uncertainty import uncertainty_sampling

def load_data(file_path):
    return np.load(file_path)

def save_model(model, filename='model_out.pkl'):
    joblib.dump(model, filename)

def save_query_indices(indices, filename='query_indices.npy'):
    np.save(filename, indices)

def parse_config(config_file):
    with open(config_file, 'r') as f:
        return json.load(f)

def main():
    parser = argparse.ArgumentParser(description="Active Learning Iteration")
    parser.add_argument('--labeled_data', type=str, required=True)
    parser.add_argument('--labeled_labels', type=str, required=True)
    parser.add_argument('--unlabeled_data', type=str, required=True)
    parser.add_argument('--model_in', type=str, required=False)
    parser.add_argument('--config', type=str, required=True)
    args = parser.parse_args()

    # Load configuration
    config = parse_config(args.config)
    n_queries = config.get("n_queries", 5)

    # Load labeled data
    X_labeled = load_data(args.labeled_data)
    y_labeled = load_data(args.labeled_labels)

    # Load model (either from file or create a new one)
    if args.model_in and os.path.exists(args.model_in):
        learner = joblib.load(args.model_in)
    else:
        base_model = LogisticRegression(solver='liblinear')
        learner = ActiveLearner(estimator=base_model, query_strategy=uncertainty_sampling)

    # Fit or re-train
    learner.fit(X_labeled, y_labeled)

    # Handle final round
    if os.path.exists(args.unlabeled_data):
        X_unlabeled = load_data(args.unlabeled_data)
        if X_unlabeled.shape[0] == 0:
            print("No more unlabeled data left. Final model trained.")
            save_model(learner)
            save_query_indices(np.array([]))  # empty query set
            return
    else:
        print("Unlabeled data file not found.")
        save_model(learner)
        save_query_indices(np.array([]))
        return

    # Query new samples
    n_samples = min(n_queries, len(X_unlabeled))
    query_idx, _ = learner.query(X_unlabeled, n_instances=n_samples)

    # Save outputs
    save_model(learner)
    save_query_indices(query_idx)

if __name__ == "__main__":
    main()

```