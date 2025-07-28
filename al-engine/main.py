# main.py - AL-Engine Main Entrypoint

import argparse
import json
import os
import sys
import logging
from pathlib import Path
from workflow_runner import WorkflowRunner
from orchestrator_client import OrchestratorClient

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ALEngine:
    def __init__(self, project_id, config_path, computation_mode='local'):
        """
        Initialize AL-Engine
        
        Args:
            project_id (str): Unique identifier for the project
            config_path (str): Path to AL configuration file
            computation_mode (str): 'local' or 'remote'
        """
        self.project_id = project_id
        self.config_path = config_path
        self.computation_mode = computation_mode
        self.workflow_runner = WorkflowRunner()
        
        if computation_mode == 'remote':
            self.orchestrator_client = OrchestratorClient()
        
        # Load configuration
        self.config = self._load_config()
        
        # Create working directory
        self.work_dir = Path(f"./al_work_{project_id}")
        self.work_dir.mkdir(exist_ok=True)
        
        logger.info(f"AL-Engine initialized for project {project_id}")
        logger.info(f"Computation mode: {computation_mode}")
        logger.info(f"Working directory: {self.work_dir}")

    def _load_config(self):
        """Load AL configuration from file"""
        try:
            with open(self.config_path, 'r') as f:
                config = json.load(f)
            logger.info(f"Configuration loaded from {self.config_path}")
            return config
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            raise

    def run_iteration(self, iteration_number):
        """
        Run a single AL iteration
        
        Args:
            iteration_number (int): Current iteration number
        """
        logger.info(f"Starting AL iteration {iteration_number}")
        
        try:
            # Prepare iteration-specific configuration
            iteration_config = {
                **self.config,
                "iteration": iteration_number,
                "project_id": self.project_id
            }
            
            # Save iteration config
            config_file = self.work_dir / f"iteration_{iteration_number}_config.json"
            with open(config_file, 'w') as f:
                json.dump(iteration_config, f, indent=2)
            
            if self.computation_mode == 'local':
                return self._run_local_iteration(iteration_number, config_file)
            else:
                return self._run_remote_iteration(iteration_number, config_file)
                
        except Exception as e:
            logger.error(f"AL iteration {iteration_number} failed: {e}")
            raise

    def _run_local_iteration(self, iteration_number, config_file):
        """Run iteration locally using cwltool"""
        logger.info(f"Running iteration {iteration_number} locally")
        
        # Prepare input files paths
        inputs = {
            'labeled_data': str(self.work_dir / f"labeled_data_iter_{iteration_number}.npy"),
            'labeled_labels': str(self.work_dir / f"labeled_labels_iter_{iteration_number}.npy"),
            'unlabeled_data': str(self.work_dir / f"unlabeled_data_iter_{iteration_number}.npy"),
            'config': str(config_file)
        }
        
        # Add model input if not first iteration
        if iteration_number > 1:
            inputs['model_in'] = str(self.work_dir / f"model_iter_{iteration_number-1}.pkl")
        
        # Run the AL iteration workflow
        result = self.workflow_runner.run_al_iteration(inputs, self.work_dir)
        
        logger.info(f"Local iteration {iteration_number} completed")
        return result

    def _run_remote_iteration(self, iteration_number, config_file):
        """Run iteration remotely via orchestrator"""
        logger.info(f"Running iteration {iteration_number} remotely")
        
        # Submit to orchestrator
        job_id = self.orchestrator_client.submit_al_iteration(
            self.project_id, 
            iteration_number, 
            config_file
        )
        
        # Wait for completion and download results
        result = self.orchestrator_client.wait_for_completion(job_id)
        
        logger.info(f"Remote iteration {iteration_number} completed")
        return result

    def run_full_workflow(self):
        """
        Run the complete AL workflow for all iterations
        """
        max_iterations = self.config.get('max_iterations', 10)
        logger.info(f"Starting full AL workflow - {max_iterations} iterations")
        
        results = []
        
        for iteration in range(1, max_iterations + 1):
            try:
                result = self.run_iteration(iteration)
                results.append(result)
                
                # Check if we should stop early (no more unlabeled data)
                if result.get('empty_query_set', False):
                    logger.info(f"No more unlabeled data. Stopping at iteration {iteration}")
                    break
                    
            except Exception as e:
                logger.error(f"Workflow failed at iteration {iteration}: {e}")
                break
        
        logger.info(f"AL workflow completed. Processed {len(results)} iterations")
        return results

    def get_model_performance(self, iteration_number=None):
        """
        Get model performance metrics
        
        Args:
            iteration_number (int, optional): Specific iteration. If None, gets latest.
        """
        if iteration_number is None:
            # Find latest model
            model_files = list(self.work_dir.glob("model_iter_*.pkl"))
            if not model_files:
                return None
            iteration_number = max([int(f.stem.split('_')[-1]) for f in model_files])
        
        performance_file = self.work_dir / f"performance_iter_{iteration_number}.json"
        
        if performance_file.exists():
            with open(performance_file, 'r') as f:
                return json.load(f)
        else:
            logger.warning(f"Performance file not found for iteration {iteration_number}")
            return None

    def cleanup(self):
        """Clean up temporary files"""
        logger.info("Cleaning up AL-Engine resources")
        # Implementation depends on cleanup strategy

def main():
    parser = argparse.ArgumentParser(description="AL-Engine - Active Learning Engine")
    parser.add_argument('--project_id', type=str, required=True, help='Project identifier')
    parser.add_argument('--config', type=str, required=True, help='AL configuration file')
    parser.add_argument('--mode', type=str, choices=['local', 'remote'], default='local', help='Computation mode')
    parser.add_argument('--iteration', type=int, help='Run specific iteration (default: run all)')
    parser.add_argument('--workflow', action='store_true', help='Run full workflow')
    
    args = parser.parse_args()
    
    try:
        # Initialize AL-Engine
        engine = ALEngine(args.project_id, args.config, args.mode)
        
        if args.iteration:
            # Run specific iteration
            result = engine.run_iteration(args.iteration)
            logger.info(f"Iteration {args.iteration} result: {result}")
        elif args.workflow:
            # Run full workflow
            results = engine.run_full_workflow()
            logger.info(f"Workflow completed with {len(results)} iterations")
        else:
            logger.error("Please specify --iteration or --workflow")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"AL-Engine failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 