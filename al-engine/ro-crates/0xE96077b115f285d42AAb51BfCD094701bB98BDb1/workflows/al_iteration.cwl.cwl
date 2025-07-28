{
  "cwlVersion": "v1.2",
  "class": "CommandLineTool",
  "label": "Active Learning Iteration (Train + Query)",
  "doc": "One-step AL iteration using modAL and scikit-learn",
  "baseCommand": "python3",
  "arguments": [
    "al_iteration.py"
  ],
  "inputs": {
    "labeled_data": {
      "type": "File",
      "inputBinding": {
        "prefix": "--labeled_data"
      }
    },
    "labeled_labels": {
      "type": "File",
      "inputBinding": {
        "prefix": "--labeled_labels"
      }
    },
    "unlabeled_data": {
      "type": "File",
      "inputBinding": {
        "prefix": "--unlabeled_data"
      }
    },
    "model_in": {
      "type": "File?",
      "inputBinding": {
        "prefix": "--model_in"
      }
    },
    "config": {
      "type": "File",
      "inputBinding": {
        "prefix": "--config"
      }
    }
  },
  "outputs": {
    "model_out": {
      "type": "File",
      "outputBinding": {
        "glob": "model_out.pkl"
      }
    },
    "query_indices": {
      "type": "File",
      "outputBinding": {
        "glob": "query_indices.npy"
      }
    }
  },
  "requirements": {
    "DockerRequirement": {
      "dockerPull": "python:3.9-slim"
    }
  },
  "metadata": {
    "queryStrategy": "uncertainty_sampling",
    "scenario": "single_annotator",
    "maxIterations": 10,
    "votingTimeout": 3600
  }
}