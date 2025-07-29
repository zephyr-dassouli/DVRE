#!/usr/bin/env python3
# AL iteration script: trains model, queries samples, and returns actual sample data.
import argparse
import json
import os
import joblib
import pandas as pd
import numpy as np
from pathlib import Path

# Dynamic model and learner imports
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from modAL.models import ActiveLearner

def detect_format(filepath):
    """Detects file format from extension."""
    return Path(filepath).suffix.lower()

def load_data(filepath, is_labels=False):
    """Loads data from CSV or NPY files."""
    ext = detect_format(filepath)
    if ext == '.csv':
        df = pd.read_csv(filepath)
        if is_labels:
            # For labels, return the last column
            return df.iloc[:, -1].values
        else:
            # For features, check if this is labeled data (has more than 4 columns for iris dataset)
            # If it has a label column, exclude it; otherwise use all columns
            if 'species' in df.columns or df.shape[1] > 4:
                # This is labeled data, exclude the last column (label)
                return df.iloc[:, :-1].values
            else:
                # This is unlabeled data, use all columns as features
                return df.values
    elif ext == '.npy':
        return np.load(filepath, allow_pickle=True)
    else:
        raise ValueError(f"Unsupported format: {ext}")

def get_model(config):
    """Initializes a model based on the configuration."""
    model_type = config.get('model_type', 'RandomForestClassifier')
    training_args = config.get('training_args', {})
    
    if model_type == 'RandomForestClassifier':
        return RandomForestClassifier(**training_args)
    elif model_type == 'LogisticRegression':
        return LogisticRegression(**training_args)
    # Add other model types here as elif blocks
    else:
        # Default to RandomForestClassifier if type is unknown
        print(f"Warning: Unknown model_type '{model_type}'. Defaulting to RandomForestClassifier.")
        return RandomForestClassifier(**training_args)

def parse_config(config_file):
    """Parse configuration file."""
    with open(config_file, 'r') as f:
        return json.load(f)

def main():
    parser = argparse.ArgumentParser(description="Active Learning Iteration")
    parser.add_argument('--labeled_data', required=True)
    parser.add_argument('--labeled_labels', required=True) 
    parser.add_argument('--unlabeled_data', required=True)
    parser.add_argument('--model_in', help="Path to pre-trained model")
    parser.add_argument('--config', required=True, help="Path to configuration JSON")
    parser.add_argument('--iteration', type=int, default=0, help="Current iteration number")
    args = parser.parse_args()

    # 1. Load config
    config = parse_config(args.config)
    print("✅ Configuration loaded.")

    # 2. Load all datasets
    X_labeled = load_data(args.labeled_data)
    y_labeled = load_data(args.labeled_labels, is_labels=True)
    X_unlabeled = load_data(args.unlabeled_data)
    print(f"✅ Data loaded: {len(y_labeled)} labeled, {len(X_unlabeled)} unlabeled.")

    # 3. Initialize model
    model = get_model(config)
    
    # 4. Initialize ActiveLearner
    learner = ActiveLearner(
        estimator=model,
        X_training=X_labeled,
        y_training=y_labeled
    )
    print("✅ ActiveLearner initialized.")

    # 5. Load pre-existing model if available (for subsequent iterations)
    if args.model_in and Path(args.model_in).exists():
        print(f"🔄 Loading model from {args.model_in}")
        learner.estimator = joblib.load(args.model_in)
    else:
        print("✨ This is the first iteration, training on initial data.")
        # The learner is already initialized with training data, so it's ready.

    # 6. Query for new samples to be labeled
    n_queries = config.get('query_batch_size', 1)
    query_indices, _ = learner.query(X_unlabeled, n_instances=n_queries)
    print(f"🎯 Queried {len(query_indices)} new instances to be labeled.")

    # 7. Get the actual data for the queried samples
    query_samples = X_unlabeled[query_indices]
    
    # 8. Save the queried SAMPLES (not indices) to a JSON file
    output_data = []
    if detect_format(Path(args.unlabeled_data)) == '.csv':
        unlabeled_df = pd.read_csv(args.unlabeled_data)
        feature_columns = unlabeled_df.columns[:-1] if unlabeled_df.shape[1] > len(query_samples[0]) else unlabeled_df.columns
        samples_df = pd.DataFrame(query_samples, columns=feature_columns[:len(query_samples[0])])
        samples_df['original_index'] = query_indices
        output_data = samples_df.to_dict(orient='records')
    else: # .npy
        output_data = [
            {'features': sample.tolist(), 'original_index': int(idx)} 
            for idx, sample in zip(query_indices, query_samples)
        ]

    # Create output directory
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    
    # Save query samples to output directory with iteration number
    query_samples_file = output_dir / f"query_samples_round_{args.iteration}.json"
    with open(query_samples_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    print(f"✅ Saved query samples to {query_samples_file}")

    # 9. Save the current model state for the next iteration
    model_dir = output_dir / "model"
    model_dir.mkdir(exist_ok=True)
    # Use iteration from CLI argument instead of config
    model_path = model_dir / f"model_round_{args.iteration}.pkl"
    joblib.dump(learner.estimator, model_path)
    print(f"✅ Saved model for next round to {model_path}")

if __name__ == '__main__':
    main() 