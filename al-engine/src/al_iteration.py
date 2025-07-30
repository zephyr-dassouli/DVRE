#!/usr/bin/env python3
# AL iteration script: trains model, queries samples, and returns actual sample data.
import argparse
import json
import os
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
import time

# Dynamic model and learner imports
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from modAL.models import ActiveLearner
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report

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
    elif model_type == 'svm':
        return SVC(probability=True, random_state=42)
    # Add other model types here as elif blocks
    else:
        # Default to RandomForestClassifier if type is unknown
        print(f"Warning: Unknown model_type '{model_type}'. Defaulting to RandomForestClassifier.")
        return RandomForestClassifier(**training_args)

def evaluate_model_performance(learner, X_test, y_test, config):
    """
    Evaluate model performance on test set and return metrics
    """
    try:
        # Make predictions
        y_pred = learner.predict(X_test)
        
        # Calculate performance metrics
        accuracy = accuracy_score(y_test, y_pred)
        
        # Handle different averaging strategies for multiclass
        average_strategy = 'weighted' if len(np.unique(y_test)) > 2 else 'binary'
        
        precision = precision_score(y_test, y_pred, average=average_strategy, zero_division=0)
        recall = recall_score(y_test, y_pred, average=average_strategy, zero_division=0)
        f1 = f1_score(y_test, y_pred, average=average_strategy, zero_division=0)
        
        # Get label space for context
        label_space = config.get('label_space', list(np.unique(y_test)))
        
        performance_metrics = {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1),
            'test_samples': len(y_test),
            'label_space': label_space,
            'average_strategy': average_strategy,
            'timestamp': time.time(),
            'iso_timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }
        
        print(f"📊 Model Performance Evaluation:")
        print(f"   Accuracy:  {accuracy:.3f}")
        print(f"   Precision: {precision:.3f}")
        print(f"   Recall:    {recall:.3f}")
        print(f"   F1-Score:  {f1:.3f}")
        print(f"   Test Set:  {len(y_test)} samples")
        
        return performance_metrics
        
    except Exception as e:
        print(f"❌ Error during performance evaluation: {e}")
        # Return basic metrics in case of error
        return {
            'accuracy': 0.0,
            'precision': 0.0,
            'recall': 0.0,
            'f1_score': 0.0,
            'test_samples': len(y_test),
            'error': str(e),
            'timestamp': time.time(),
            'iso_timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }

def parse_config(config_file):
    """Parse configuration file."""
    with open(config_file, 'r') as f:
        return json.load(f)

def main():
    parser = argparse.ArgumentParser(description='AL Iteration with Performance Evaluation')
    parser.add_argument('--labeled_data', required=True, help='Path to labeled data file')
    parser.add_argument('--labeled_labels', required=True, help='Path to labeled labels file')
    parser.add_argument('--unlabeled_data', required=True, help='Path to unlabeled data file')
    parser.add_argument('--model_in', help='Path to input model file (optional)')
    parser.add_argument('--iteration', type=int, required=True, help='Current iteration number')
    parser.add_argument('--config', required=True, help='Path to configuration file')
    parser.add_argument('--project_id', help='Project ID for output organization')
    
    args = parser.parse_args()

    # Parse configuration
    config = parse_config(args.config)
    
    # Determine output directory based on execution context
    if args.project_id:
        # Check if we're running from CWL (current working directory is a temp dir)
        cwd = Path.cwd()
        if str(cwd).startswith('/tmp') or str(cwd).startswith('/private/tmp') or 'docker_tmp' in str(cwd):
            # Running from CWL - use current working directory (CWL will handle output collection)
            output_dir = Path(".")
            print(f"📁 Using CWL working directory for outputs: {output_dir.resolve()}")
        else:
            # Running directly - use ro-crate structure
            # Find the DVRE project root (look for al-engine directory)
            script_path = Path(__file__).resolve()
            
            # Look for al-engine directory by traversing up
            current_dir = script_path.parent
            while current_dir != current_dir.parent:
                if (current_dir.parent / "al-engine").exists():
                    base_dir = current_dir.parent
                    break
                current_dir = current_dir.parent
            else:
                # Fallback: try relative path from script location
                base_dir = script_path.parent.parent
            
            output_dir = base_dir / "al-engine" / "ro-crates" / args.project_id / "outputs"
            print(f"📁 Using ro-crate outputs directory: {output_dir}")
    else:
        # Fallback to local output directory
        output_dir = Path("output")
        print(f"📁 Using local outputs directory: {output_dir}")
    
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"🚀 Starting AL Iteration {args.iteration} with Performance Evaluation")

    # 1. Load config
    # config = parse_config(args.config) # This line is now redundant as config is parsed above
    print("✅ Configuration loaded.")

    # 2. Load all datasets
    X_labeled = load_data(args.labeled_data)
    y_labeled = load_data(args.labeled_labels, is_labels=True)
    X_unlabeled = load_data(args.unlabeled_data)
    print(f"✅ Data loaded: {len(y_labeled)} labeled, {len(X_unlabeled)} unlabeled.")

    # 3. Split labeled data into train/test for performance evaluation
    # Use 80/20 split for training/testing
    if len(X_labeled) > 10:  # Only split if we have enough data
        X_train, X_test, y_train, y_test = train_test_split(
            X_labeled, y_labeled, test_size=0.2, random_state=42, stratify=y_labeled
        )
        print(f"📊 Data split: {len(X_train)} training, {len(X_test)} testing")
    else:
        # For small datasets, use all data for training and testing (not ideal but necessary)
        X_train, X_test = X_labeled, X_labeled
        y_train, y_test = y_labeled, y_labeled
        print(f"⚠️ Small dataset: using all {len(X_labeled)} samples for both training and testing")

    # 4. Initialize model
    model = get_model(config)
    
    # 5. Initialize ActiveLearner
    learner = ActiveLearner(
        estimator=model,
        X_training=X_train,
        y_training=y_train
    )
    print("✅ ActiveLearner initialized.")

    # 6. Load pre-existing model if available (for subsequent iterations)
    if args.model_in and Path(args.model_in).exists():
        print(f"🔄 Loading model from {args.model_in}")
        learner.estimator = joblib.load(args.model_in)
        
        # Re-evaluate performance of loaded model
        print("🔍 Evaluating loaded model performance...")
    else:
        print("✨ This is the first iteration, training on initial data.")

    # 7. **PERFORMANCE EVALUATION STEP**
    print("\n📊 Evaluating model performance...")
    performance_metrics = evaluate_model_performance(learner, X_test, y_test, config)

    # 8. Query for new samples to be labeled
    n_queries = config.get('query_batch_size', 1)
    query_indices, _ = learner.query(X_unlabeled, n_instances=n_queries)
    print(f"🎯 Queried {len(query_indices)} new instances to be labeled.")

    # 9. Get the actual data for the queried samples
    query_samples = X_unlabeled[query_indices]
    
    # 10. Save the queried SAMPLES (not indices) to a JSON file
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

    # 11. Save query samples to output directory with iteration number
    query_samples_file = output_dir / f"query_samples_round_{args.iteration}.json"
    with open(query_samples_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    print(f"✅ Saved query samples to {query_samples_file}")

    # 12. **SAVE PERFORMANCE METRICS TO RO-CRATE OUTPUTS**
    performance_file = output_dir / f"performance_round_{args.iteration}.json"
    with open(performance_file, 'w') as f:
        json.dump(performance_metrics, f, indent=2)
    print(f"📊 Saved performance metrics to {performance_file}")

    # 13. Save the current model state for the next iteration
    model_path = output_dir / f"model_round_{args.iteration}.pkl"
    joblib.dump(learner.estimator, model_path)
    print(f"✅ Saved model for next round to {model_path}")

    print(f"\n🎉 AL Iteration {args.iteration} completed successfully!")
    print(f"📊 Performance: Accuracy={performance_metrics['accuracy']:.3f}, F1={performance_metrics['f1_score']:.3f}")
    print(f"📁 All outputs saved to: {output_dir}")

if __name__ == '__main__':
    main() 