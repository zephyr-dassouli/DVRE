#!/usr/bin/env python3
"""
🧪 Mock Voting Results Generator
Creates fake voting results to test the AL-Engine cumulative learning fix
"""

import json
import argparse
from pathlib import Path
import time

def create_mock_voting_results(project_id, iteration, sample_indices, labels):
    """Create mock voting results for testing"""
    
    # Find project directory
    base_dir = Path(__file__).parent
    project_dir = base_dir / "ro-crates" / project_id / "outputs"
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # Create mock voting results
    voting_results = []
    
    for i, (sample_idx, label) in enumerate(zip(sample_indices, labels)):
        vote_result = {
            "original_index": int(sample_idx),
            "final_label": label,
            "sample_data": {
                "sepal length (cm)": 6.2 + i * 0.1,
                "sepal width (cm)": 3.4 + i * 0.1, 
                "petal length (cm)": 5.4 + i * 0.1,
                "petal width (cm)": 2.3 + i * 0.1
            },
            "votes": {
                "user1": label,
                "user2": label
            },
            "consensus": True,
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            "round": iteration
        }
        voting_results.append(vote_result)
    
    # Save voting results
    voting_file = project_dir / f"voting_results_round_{iteration}.json"
    with open(voting_file, 'w') as f:
        json.dump(voting_results, f, indent=2)
    
    print(f"✅ Created mock voting results: {voting_file}")
    print(f"📊 Samples: {len(voting_results)}")
    for result in voting_results:
        print(f"   - Sample {result['original_index']}: {result['final_label']}")
    
    return voting_file

def main():
    parser = argparse.ArgumentParser(description='Create mock voting results for testing AL-Engine fix')
    parser.add_argument('--project_id', required=True, help='Project ID')
    parser.add_argument('--iteration', type=int, default=1, help='Iteration number')
    parser.add_argument('--samples', default='66,94', help='Comma-separated sample indices')
    parser.add_argument('--labels', default='2,2', help='Comma-separated labels for samples')
    
    args = parser.parse_args()
    
    sample_indices = [int(x.strip()) for x in args.samples.split(',')]
    labels = [x.strip() for x in args.labels.split(',')]
    
    if len(sample_indices) != len(labels):
        print("❌ Error: Number of samples and labels must match")
        return
    
    print(f"🧪 Creating mock voting results for project {args.project_id}")
    print(f"📊 Iteration: {args.iteration}")
    print(f"🎯 Samples: {sample_indices}")
    print(f"🏷️ Labels: {labels}")
    
    create_mock_voting_results(args.project_id, args.iteration, sample_indices, labels)
    
    print(f"\n💡 Now run the next AL iteration to see cumulative learning in action:")
    print(f"   cd al-engine/src")
    print(f"   python al_iteration.py --iteration {args.iteration + 1} --project_id {args.project_id} \\")
    print(f"     --labeled_data ../ro-crates/{args.project_id}/inputs/datasets/labeled_samples.csv \\")
    print(f"     --labeled_labels ../ro-crates/{args.project_id}/inputs/datasets/labeled_samples.csv \\")
    print(f"     --unlabeled_data ../ro-crates/{args.project_id}/inputs/datasets/unlabeled_samples.csv \\")
    print(f"     --config ../ro-crates/{args.project_id}/config.json")

if __name__ == '__main__':
    main() 