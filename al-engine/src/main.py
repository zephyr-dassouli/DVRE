# main.py - AL-Engine Main Entrypoint

import argparse
import json
import os
import sys
import logging
import time
import signal
import threading
from pathlib import Path
from flask import Flask, request, jsonify
from workflow_runner import WorkflowRunner

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ALEngineServer:
    """
    AL-Engine with HTTP API server for DAL communication (Local execution only)
    """
    
    def __init__(self, project_id=None, config_path=None, port=5050):
        self.project_id = project_id
        self.config_path = config_path
        self.port = port
        self.workflow_runner = WorkflowRunner()
        self.running = False
        
        # These will be initialized when needed via API calls
        self.config = None
        self.work_dir = None
        self.signal_dir = None
        
        # Initialize project-specific resources if provided
        if project_id and config_path:
            self._initialize_project(project_id, config_path)
        
        # Initialize Flask app
        self.app = Flask(__name__)
        self.setup_routes()
        
        logger.info(f"AL-Engine Server initialized")
        logger.info(f"Computation mode: local (only)")
        logger.info(f"API server port: {port}")
        if project_id:
            logger.info(f"Project: {project_id}")
        else:
            logger.info("Server mode: waiting for project-specific API calls")

    def _initialize_project(self, project_id, config_path):
        """Initialize project-specific resources"""
        self.project_id = project_id
        self.config_path = config_path
        
        # Load configuration
        self.config = self._load_config()
        
        # Create working directory inside the ro-crates project folder
        self.work_dir = Path(f"../ro-crates/{project_id}/work")
        self.work_dir.mkdir(parents=True, exist_ok=True)
        
        # Service mode paths
        self.signal_dir = Path(f"../ro-crates/{project_id}/signals")
        self.signal_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Initialized project resources for {project_id}")
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

    def setup_routes(self):
        """Setup Flask API routes"""
        
        # Add CORS support for cross-origin requests from JupyterLab
        @self.app.after_request
        def after_request(response):
            """Add CORS headers to all responses"""
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
        
        # Handle preflight OPTIONS requests
        @self.app.route('/<path:path>', methods=['OPTIONS'])
        def handle_options(path):
            """Handle preflight requests for all routes"""
            return '', 200
        
        @self.app.route('/health', methods=['GET'])
        def health_check():
            """Health check endpoint"""
            return jsonify({
                'status': 'healthy',
                'project_id': self.project_id,
                'computation_mode': 'local',
                'timestamp': time.time()
            })

        @self.app.route('/start_iteration', methods=['POST'])
        def start_iteration():
            """Start AL iteration endpoint"""
            try:
                data = request.get_json()
                if not data:
                    return jsonify({'error': 'No JSON data provided'}), 400
                
                iteration = data.get('iteration')
                if not iteration:
                    return jsonify({'error': 'iteration number is required'}), 400
                
                logger.info(f"📨 Received start_iteration request for iteration {iteration}")
                
                # Execute AL iteration locally
                result = self._execute_iteration_sync(iteration, data)
                
                if result.get('success'):
                    logger.info(f"✅ Iteration {iteration} completed successfully")
                    return jsonify({
                        'success': True,
                        'iteration': iteration,
                        'result': result,
                        'message': f'AL iteration {iteration} completed successfully'
                    })
                else:
                    logger.error(f"❌ Iteration {iteration} failed: {result.get('error')}")
                    return jsonify({
                        'success': False,
                        'iteration': iteration,
                        'error': result.get('error'),
                        'message': f'AL iteration {iteration} failed'
                    }), 500
                    
            except Exception as e:
                logger.error(f"❌ API error in start_iteration: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e),
                    'message': 'Internal server error'
                }), 500

        @self.app.route('/status', methods=['GET'])
        def get_status():
            """Get AL-Engine status"""
            return jsonify({
                'project_id': self.project_id,
                'computation_mode': 'local',
                'work_dir': str(self.work_dir),
                'config_path': self.config_path,  
                'running': True,
                'timestamp': time.time()
            })

        @self.app.route('/config', methods=['GET'])
        def get_config():
            """Get current AL configuration"""
            return jsonify(self.config)

        @self.app.route('/results/<int:iteration>', methods=['GET'])
        def get_iteration_results(iteration):
            """Get results for a specific iteration"""
            try:
                project_id = request.args.get('project_id', self.project_id)
                if not project_id:
                    return jsonify({'error': 'No project_id provided'}), 400
                
                # Check for actual result files generated by AL iteration
                outputs_dir = Path(f"../ro-crates/{project_id}/outputs")
                model_file = outputs_dir / "model" / f"model_round_{iteration}.pkl"
                query_samples_file = outputs_dir / f"query_samples_round_{iteration}.json"
                
                results = {
                    'iteration': iteration,
                    'project_id': project_id,
                    'files': {
                        'model': str(model_file) if model_file.exists() else None,
                        'query_samples': str(query_samples_file) if query_samples_file.exists() else None,
                        'performance': None  # Not implemented yet
                    }
                }
                
                # Load and return actual query samples if available
                if query_samples_file.exists():
                    with open(query_samples_file, 'r') as f:
                        query_samples_data = json.load(f)
                        results['query_samples'] = query_samples_data
                        logger.info(f"✅ Loaded {len(query_samples_data)} query samples for iteration {iteration}")
                else:
                    logger.warning(f"⚠️ Query samples file not found: {query_samples_file}")
                
                return jsonify(results)
                
            except Exception as e:
                logger.error(f"❌ Error getting results for iteration {iteration}: {e}")
                return jsonify({'error': str(e)}), 500

        @self.app.route('/submit_labels', methods=['POST'])
        def submit_labels():
            """Submit labeled samples back to AL-Engine for next training iteration"""
            try:
                data = request.get_json()
                if not data:
                    return jsonify({'error': 'No JSON data provided'}), 400
                
                # Validate required fields
                required_fields = ['iteration', 'labeled_samples']
                for field in required_fields:
                    if field not in data:
                        return jsonify({'error': f'Missing required field: {field}'}), 400
                
                iteration = data.get('iteration')
                labeled_samples = data.get('labeled_samples', [])
                project_id = data.get('project_id', self.project_id)
                
                if not labeled_samples:
                    return jsonify({'error': 'No labeled samples provided'}), 400
                
                logger.info(f"📨 Received {len(labeled_samples)} labeled samples for iteration {iteration}")
                
                # Process and store the labeled samples
                result = self._process_labeled_samples(iteration, labeled_samples, project_id)
                
                if result.get('success'):
                    logger.info(f"✅ Successfully processed {len(labeled_samples)} labeled samples")
                    return jsonify({
                        'success': True,
                        'iteration': iteration,
                        'samples_processed': len(labeled_samples),
                        'message': f'Successfully stored {len(labeled_samples)} labeled samples for iteration {iteration}',
                        'next_iteration_ready': result.get('next_iteration_ready', False)
                    })
                else:
                    logger.error(f"❌ Failed to process labeled samples: {result.get('error')}")
                    return jsonify({
                        'success': False,
                        'iteration': iteration,
                        'error': result.get('error'),
                        'message': 'Failed to process labeled samples'
                    }), 500
                    
            except Exception as e:
                logger.error(f"❌ API error in submit_labels: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e),
                    'message': 'Internal server error while processing labeled samples'
                }), 500

    def _execute_iteration_sync(self, iteration_number, request_data):
        """Execute AL iteration synchronously for API calls (local only)"""
        logger.info(f"🤖 Executing AL iteration {iteration_number} locally via API")
        
        try:
            # Check if we need to initialize project from request data
            project_id = request_data.get('project_id')
            if not self.project_id and project_id:
                # Initialize project dynamically from request
                config_path = f"../ro-crates/{project_id}/config.json"
                logger.info(f"Dynamically initializing project: {project_id}")
                self._initialize_project(project_id, config_path)
            elif not self.project_id:
                raise ValueError("No project_id provided in request and server not initialized with a project")
            
            # Use the original config file - inject iteration at runtime
            original_config_file = Path(self.config_path)
            
            # Execute the iteration locally, passing iteration number
            result = self._run_local_iteration(iteration_number, original_config_file)
            
            logger.info(f"✅ AL iteration {iteration_number} completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"❌ AL iteration {iteration_number} failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'iteration': iteration_number
            }

    def _run_local_iteration(self, iteration_number, config_file):
        """Run iteration locally using cwltool to execute the CWL workflow"""
        logger.info(f"Running iteration {iteration_number} locally via CWL workflow")
        
        try:
            # Find the CWL workflow file for this project
            cwl_file = Path(f"../ro-crates/{self.project_id}/al_iteration.cwl")
            inputs_file = Path(f"../ro-crates/{self.project_id}/inputs.yml")
            
            if not cwl_file.exists():
                raise FileNotFoundError(f"CWL workflow not found: {cwl_file}")
            
            if not inputs_file.exists():
                raise FileNotFoundError(f"CWL inputs file not found: {inputs_file}")
            
            # Create simple job file with iteration number
            import tempfile, yaml
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False) as temp_job:
                # Use absolute paths for all files
                datasets_dir = inputs_file.parent / 'inputs' / 'datasets'
                job_inputs = {
                    'labeled_data': {'class': 'File', 'path': str((datasets_dir / 'labeled_samples.csv').resolve())},
                    'labeled_labels': {'class': 'File', 'path': str((datasets_dir / 'labeled_samples.csv').resolve())},
                    'unlabeled_data': {'class': 'File', 'path': str((datasets_dir / 'unlabeled_samples.csv').resolve())},
                    'config': {'class': 'File', 'path': str(config_file.resolve())},
                    'iteration': iteration_number
                }
                yaml.dump(job_inputs, temp_job, default_flow_style=False)
                temp_job_path = temp_job.name
            
            # Execute CWL workflow using cwltool
            import subprocess
            
            # Create outputs directory in ro-crate structure
            outputs_dir = inputs_file.parent / "outputs"
            outputs_dir.mkdir(exist_ok=True)
            
            cmd = [
                "cwltool",
                "--outdir", str(outputs_dir),
                str(cwl_file),
                temp_job_path
            ]
            
            logger.info(f"🔧 Executing CWL workflow: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd="."
            )
            
            # Cleanup temporary files
            try:
                os.unlink(temp_job_path)
            except:
                pass
            
            if result.returncode == 0:
                logger.info("✅ CWL workflow completed successfully")
                logger.info(f"CWL stdout: {result.stdout}")
                
                # Parse CWL outputs
                outputs = self._parse_cwl_outputs(result.stdout, outputs_dir)
                
                # Return workflow result
                return {
                    'success': True,
                    'outputs': outputs,
                    'stdout': result.stdout,
                    'execution_method': 'cwltool'
                }
            else:
                logger.error(f"❌ CWL workflow failed with return code {result.returncode}")
                logger.error(f"CWL stderr: {result.stderr}")
                
                return {
                    'success': False,
                    'error': f"CWL execution failed: {result.stderr}",
                    'returncode': result.returncode,
                    'execution_method': 'cwltool'
                }
                
        except FileNotFoundError as e:
            logger.error(f"❌ CWL workflow files not found: {e}")
            
            # Fallback to WorkflowRunner if CWL files are missing
            logger.info("🔄 Falling back to WorkflowRunner execution")
            return self._run_fallback_iteration(iteration_number, config_file)
            
        except Exception as e:
            logger.error(f"❌ Error executing CWL workflow: {e}")
            
            # Fallback to WorkflowRunner
            logger.info("🔄 Falling back to WorkflowRunner execution")
            return self._run_fallback_iteration(iteration_number, config_file)

    def _update_inputs_file(self, inputs_file, iteration_number, config_file):
        """No need to update inputs file - use original static files"""
        # Just return the original inputs file without modifications
        logger.info(f"📝 Using original inputs file for iteration {iteration_number}")
        return inputs_file

    def _parse_cwl_outputs(self, stdout, outputs_dir):
        """Parse CWL outputs from stdout"""
        outputs = {}
        
        try:
            # Look for output files in the new output directory structure
            query_samples_files = list(outputs_dir.glob("query_samples_round_*.json"))
            if query_samples_files:
                outputs['query_samples'] = str(query_samples_files[0])
                
            # Look for model files in output/model directory
            model_files = list((outputs_dir / "model").glob("model_round_*.pkl"))
            if model_files:
                outputs['model_out'] = str(model_files[0])
                
            logger.info(f"📊 CWL outputs found: {list(outputs.keys())}")
            
        except Exception as e:
            logger.warning(f"⚠️ Error parsing CWL outputs: {e}")
            
        return outputs

    def _run_fallback_iteration(self, iteration_number, config_file):
        """Fallback execution using WorkflowRunner if CWL is not available"""
        logger.info(f"Running fallback iteration {iteration_number} using WorkflowRunner")
        
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
        
        # Run the AL iteration workflow using WorkflowRunner
        result = self.workflow_runner.run_al_iteration(inputs, self.work_dir)
        
        logger.info(f"Fallback iteration {iteration_number} completed")
        return result

    def _process_labeled_samples(self, iteration_number, labeled_samples, project_id):
        """Process and store labeled samples for the next training iteration"""
        logger.info(f"🔄 Processing {len(labeled_samples)} labeled samples for iteration {iteration_number}")
        
        try:
            # Create directory for iteration data
            iteration_dir = self.work_dir / f"iteration_{iteration_number}"
            iteration_dir.mkdir(exist_ok=True)
            
            # Process labeled samples - expected format:
            # [{"sample_id": "...", "sample_data": {...}, "label": "positive", "original_index": 123}, ...]
            processed_samples = []
            features_list = []
            labels_list = []
            
            for sample in labeled_samples:
                try:
                    sample_id = sample.get('sample_id')
                    sample_data = sample.get('sample_data', sample.get('features'))
                    label = sample.get('label')
                    original_index = sample.get('original_index', -1)
                    
                    if not sample_data or not label:
                        logger.warn(f"⚠️ Skipping incomplete sample: {sample}")
                        continue
                    
                    # Extract features (handle different data formats)
                    if isinstance(sample_data, dict):
                        if 'features' in sample_data:
                            features = sample_data['features']
                        else:
                            # Use all numeric values from the dict as features
                            features = [v for v in sample_data.values() if isinstance(v, (int, float))]
                    elif isinstance(sample_data, list):
                        features = sample_data
                    else:
                        features = [sample_data]  # Single feature
                    
                    features_list.append(features)
                    labels_list.append(label)
                    
                    processed_samples.append({
                        'sample_id': sample_id,
                        'features': features,
                        'label': label,
                        'original_index': original_index,
                        'processed_at': time.time()
                    })
                    
                except Exception as sample_error:
                    logger.error(f"❌ Error processing sample: {sample_error}")
                    continue
            
            if not processed_samples:
                return {
                    'success': False,
                    'error': 'No valid samples could be processed'
                }
            
            # Save processed samples as JSON
            samples_file = iteration_dir / f"labeled_samples_{iteration_number}.json"
            with open(samples_file, 'w') as f:
                json.dump(processed_samples, f, indent=2)
            
            # Save features and labels as numpy arrays for next training iteration
            import numpy as np
            
            features_array = np.array(features_list)
            labels_array = np.array(labels_list)
            
            features_file = iteration_dir / f"labeled_data_iter_{iteration_number + 1}.npy"
            labels_file = iteration_dir / f"labeled_labels_iter_{iteration_number + 1}.npy"
            
            np.save(features_file, features_array)
            np.save(labels_file, labels_array)
            
            logger.info(f"✅ Saved {len(processed_samples)} samples for next iteration")
            logger.info(f"📁 Features: {features_file}")
            logger.info(f"📁 Labels: {labels_file}")
            logger.info(f"📁 JSON: {samples_file}")
            
            # Check if we have enough samples for next iteration
            next_iteration_ready = len(processed_samples) > 0
            
            return {
                'success': True,
                'samples_processed': len(processed_samples),
                'features_shape': features_array.shape,
                'unique_labels': list(set(labels_list)),
                'next_iteration_ready': next_iteration_ready,
                'saved_files': [str(samples_file), str(features_file), str(labels_file)]
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to process labeled samples: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def start_server(self):
        """Start the Flask API server"""
        logger.info(f"🚀 Starting AL-Engine API server on port {self.port}")
        logger.info(f"📡 API endpoints available:")
        logger.info(f"   GET  http://localhost:{self.port}/health")
        logger.info(f"   POST http://localhost:{self.port}/start_iteration")
        logger.info(f"   GET  http://localhost:{self.port}/status")
        logger.info(f"   GET  http://localhost:{self.port}/config")
        logger.info(f"   GET  http://localhost:{self.port}/results/<iteration>")
        logger.info(f"   POST http://localhost:{self.port}/submit_labels")
        
        try:
            self.app.run(
                host='0.0.0.0',
                port=self.port,
                debug=False,
                threaded=True
            )
        except Exception as e:
            logger.error(f"❌ Failed to start API server: {e}")
            raise

# Legacy ALEngine class for backward compatibility
class ALEngine:
    def __init__(self, project_id, config_path):
        """
        Initialize AL-Engine (Local execution only)
        
        Args:
            project_id (str): Unique identifier for the project
            config_path (str): Path to AL configuration file
        """
        self.project_id = project_id
        self.config_path = config_path
        self.workflow_runner = WorkflowRunner()
        self.running = False
        
        # Load configuration
        self.config = self._load_config()
        
        # Create working directory inside the ro-crates project folder
        self.work_dir = Path(f"../ro-crates/{project_id}/work")
        self.work_dir.mkdir(parents=True, exist_ok=True)
        
        # Service mode paths
        self.signal_dir = Path(f"../ro-crates/{project_id}/signals")
        self.signal_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"AL-Engine initialized for project {project_id}")
        logger.info(f"Computation mode: local (only)")
        logger.info(f"Working directory: {self.work_dir}")
        logger.info(f"Signal directory: {self.signal_dir}")

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
        Run a single AL iteration locally
        
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
            
            # Run local iteration
            result = self._run_local_iteration(iteration_number, config_file)
            return result
                
        except Exception as e:
            logger.error(f"AL iteration {iteration_number} failed: {e}")
            raise

    def _run_local_iteration(self, iteration_number, config_file):
        """Run iteration locally using cwltool to execute the CWL workflow"""
        logger.info(f"Running iteration {iteration_number} locally via CWL workflow")
        
        try:
            # Find the CWL workflow file for this project
            cwl_file = Path(f"../ro-crates/{self.project_id}/al_iteration.cwl")
            inputs_file = Path(f"../ro-crates/{self.project_id}/inputs.yml")
            
            if not cwl_file.exists():
                raise FileNotFoundError(f"CWL workflow not found: {cwl_file}")
            
            if not inputs_file.exists():
                raise FileNotFoundError(f"CWL inputs file not found: {inputs_file}")
            
            # Create simple job file with iteration number
            import tempfile, yaml
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False) as temp_job:
                # Use absolute paths for all files
                datasets_dir = inputs_file.parent / 'inputs' / 'datasets'
                job_inputs = {
                    'labeled_data': {'class': 'File', 'path': str((datasets_dir / 'labeled_samples.csv').resolve())},
                    'labeled_labels': {'class': 'File', 'path': str((datasets_dir / 'labeled_samples.csv').resolve())},
                    'unlabeled_data': {'class': 'File', 'path': str((datasets_dir / 'unlabeled_samples.csv').resolve())},
                    'config': {'class': 'File', 'path': str(config_file.resolve())},
                    'iteration': iteration_number
                }
                yaml.dump(job_inputs, temp_job, default_flow_style=False)
                temp_job_path = temp_job.name
            
            # Execute CWL workflow using cwltool
            import subprocess
            
            # Create outputs directory in ro-crate structure
            outputs_dir = inputs_file.parent / "outputs"
            outputs_dir.mkdir(exist_ok=True)
            
            cmd = [
                "cwltool",
                "--outdir", str(outputs_dir),
                str(cwl_file),
                temp_job_path
            ]
            
            logger.info(f"🔧 Executing CWL workflow: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=os.path.dirname(self.project_dir)
            )
            
            # Cleanup temporary files
            try:
                os.unlink(temp_job_path)
            except:
                pass
            
            if result.returncode == 0:
                logger.info("✅ CWL workflow completed successfully")
                logger.info(f"CWL stdout: {result.stdout}")
                
                # Parse CWL outputs
                outputs = self._parse_cwl_outputs(result.stdout, outputs_dir)
                
                # Return workflow result
                return {
                    'success': True,
                    'outputs': outputs,
                    'stdout': result.stdout,
                    'execution_method': 'cwltool'
                }
            else:
                logger.error(f"❌ CWL workflow failed with return code {result.returncode}")
                logger.error(f"CWL stderr: {result.stderr}")
                
                return {
                    'success': False,
                    'error': f"CWL execution failed: {result.stderr}",
                    'returncode': result.returncode,
                    'execution_method': 'cwltool'
                }
                
        except FileNotFoundError as e:
            logger.error(f"❌ CWL workflow files not found: {e}")
            
            # Fallback to WorkflowRunner if CWL files are missing
            logger.info("🔄 Falling back to WorkflowRunner execution")
            return self._run_fallback_iteration(iteration_number, config_file)
            
        except Exception as e:
            logger.error(f"❌ Error executing CWL workflow: {e}")
            
            # Fallback to WorkflowRunner
            logger.info("🔄 Falling back to WorkflowRunner execution")
            return self._run_fallback_iteration(iteration_number, config_file)

    def _update_inputs_file(self, inputs_file, iteration_number, config_file):
        """Create a new job input file for this iteration"""
        try:
            # Create a new job input file for this iteration
            job_inputs = {
                'labeled_data': {
                    'class': 'File',
                    'path': str(inputs_file.parent / 'inputs' / 'datasets' / 'labeled_samples.csv')
                },
                'labeled_labels': {
                    'class': 'File', 
                    'path': str(inputs_file.parent / 'inputs' / 'datasets' / 'labeled_samples.csv')
                },
                'unlabeled_data': {
                    'class': 'File',
                    'path': str(inputs_file.parent / 'inputs' / 'datasets' / 'unlabeled_samples.csv')
                },
                'config': {
                    'class': 'File',
                    'path': str(config_file)
                }
            }
            
            # Add model input if not first iteration
            if iteration_number > 1:
                model_file = self.work_dir / f"model_round_{iteration_number-1}.pkl"
                if model_file.exists():
                    job_inputs['model_in'] = {
                        'class': 'File',
                        'path': str(model_file)
                    }
            
            # Write the job input file
            import yaml
            iteration_job_file = inputs_file.parent / f"job_iteration_{iteration_number}.yml"
            with open(iteration_job_file, 'w') as f:
                yaml.dump(job_inputs, f, default_flow_style=False)
                
            logger.info(f"📝 Created job input file for iteration {iteration_number}: {iteration_job_file}")
            return iteration_job_file
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to create job input file: {e}")
            return inputs_file

    def _parse_cwl_outputs(self, stdout, outputs_dir):
        """Parse CWL outputs from stdout"""
        outputs = {}
        
        try:
            # Look for output files in the new output directory structure
            query_samples_files = list(outputs_dir.glob("query_samples_round_*.json"))
            if query_samples_files:
                outputs['query_samples'] = str(query_samples_files[0])
                
            # Look for model files in output/model directory
            model_files = list((outputs_dir / "model").glob("model_round_*.pkl"))
            if model_files:
                outputs['model_out'] = str(model_files[0])
                
            logger.info(f"📊 CWL outputs found: {list(outputs.keys())}")
            
        except Exception as e:
            logger.warning(f"⚠️ Error parsing CWL outputs: {e}")
            
        return outputs

    def _run_fallback_iteration(self, iteration_number, config_file):
        """Fallback execution using WorkflowRunner if CWL is not available"""
        logger.info(f"Running fallback iteration {iteration_number} using WorkflowRunner")
        
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
        
        # Run the AL iteration workflow using WorkflowRunner
        result = self.workflow_runner.run_al_iteration(inputs, self.work_dir)
        
        logger.info(f"Fallback iteration {iteration_number} completed")
        return result

    def _process_labeled_samples(self, iteration_number, labeled_samples, project_id):
        """Process and store labeled samples for the next training iteration"""
        logger.info(f"🔄 Processing {len(labeled_samples)} labeled samples for iteration {iteration_number}")
        
        try:
            # Create directory for iteration data
            iteration_dir = self.work_dir / f"iteration_{iteration_number}"
            iteration_dir.mkdir(exist_ok=True)
            
            # Process labeled samples - expected format:
            # [{"sample_id": "...", "sample_data": {...}, "label": "positive", "original_index": 123}, ...]
            processed_samples = []
            features_list = []
            labels_list = []
            
            for sample in labeled_samples:
                try:
                    sample_id = sample.get('sample_id')
                    sample_data = sample.get('sample_data', sample.get('features'))
                    label = sample.get('label')
                    original_index = sample.get('original_index', -1)
                    
                    if not sample_data or not label:
                        logger.warn(f"⚠️ Skipping incomplete sample: {sample}")
                        continue
                    
                    # Extract features (handle different data formats)
                    if isinstance(sample_data, dict):
                        if 'features' in sample_data:
                            features = sample_data['features']
                        else:
                            # Use all numeric values from the dict as features
                            features = [v for v in sample_data.values() if isinstance(v, (int, float))]
                    elif isinstance(sample_data, list):
                        features = sample_data
                    else:
                        features = [sample_data]  # Single feature
                    
                    features_list.append(features)
                    labels_list.append(label)
                    
                    processed_samples.append({
                        'sample_id': sample_id,
                        'features': features,
                        'label': label,
                        'original_index': original_index,
                        'processed_at': time.time()
                    })
                    
                except Exception as sample_error:
                    logger.error(f"❌ Error processing sample: {sample_error}")
                    continue
            
            if not processed_samples:
                return {
                    'success': False,
                    'error': 'No valid samples could be processed'
                }
            
            # Save processed samples as JSON
            samples_file = iteration_dir / f"labeled_samples_{iteration_number}.json"
            with open(samples_file, 'w') as f:
                json.dump(processed_samples, f, indent=2)
            
            # Save features and labels as numpy arrays for next training iteration
            import numpy as np
            
            features_array = np.array(features_list)
            labels_array = np.array(labels_list)
            
            features_file = iteration_dir / f"labeled_data_iter_{iteration_number + 1}.npy"
            labels_file = iteration_dir / f"labeled_labels_iter_{iteration_number + 1}.npy"
            
            np.save(features_file, features_array)
            np.save(labels_file, labels_array)
            
            logger.info(f"✅ Saved {len(processed_samples)} samples for next iteration")
            logger.info(f"📁 Features: {features_file}")
            logger.info(f"📁 Labels: {labels_file}")
            logger.info(f"📁 JSON: {samples_file}")
            
            # Check if we have enough samples for next iteration
            next_iteration_ready = len(processed_samples) > 0
            
            return {
                'success': True,
                'samples_processed': len(processed_samples),
                'features_shape': features_array.shape,
                'unique_labels': list(set(labels_list)),
                'next_iteration_ready': next_iteration_ready,
                'saved_files': [str(samples_file), str(features_file), str(labels_file)]
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to process labeled samples: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def run_full_workflow(self):
        """
        Run the complete AL workflow for all iterations locally
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

    def start_service_mode(self):
        """
        Start AL-Engine in service mode - waits for DAL signals to trigger iterations (Local only)
        """
        logger.info(f"🚀 Starting AL-Engine service mode for project {self.project_id}")
        logger.info("📡 Waiting for DAL signals to start iterations...")
        
        self.running = True
        
        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        # Main service loop
        while self.running:
            try:
                # Check for iteration start signals from DAL
                start_signal = self._check_for_start_signal()
                
                if start_signal:
                    iteration_number = start_signal['iteration']
                    logger.info(f"📨 Received start signal for iteration {iteration_number}")
                    
                    # Execute the AL iteration locally
                    result = self._execute_iteration_for_service(iteration_number, start_signal)
                    
                    # Send result back to DAL
                    self._send_result_to_dal(iteration_number, result)
                    
                    # Clean up the processed signal
                    self._cleanup_signal(start_signal['signal_file'])
                
                # Sleep briefly to avoid busy waiting
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"❌ Error in service loop: {e}")
                time.sleep(5)  # Wait longer on error
        
        logger.info("🛑 AL-Engine service mode stopped")

    def _check_for_start_signal(self):
        """Check for start iteration signals from DAL"""
        signal_files = list(self.signal_dir.glob("start_iteration_*.json"))
        
        if signal_files:
            # Process the oldest signal first
            signal_file = min(signal_files, key=os.path.getctime)
            
            try:
                with open(signal_file, 'r') as f:
                    signal_data = json.load(f)
                
                signal_data['signal_file'] = signal_file
                return signal_data
                
            except Exception as e:
                logger.error(f"❌ Failed to read signal file {signal_file}: {e}")
                # Remove corrupted signal file
                try:
                    signal_file.unlink()
                except:
                    pass
        
        return None

    def _execute_iteration_for_service(self, iteration_number, signal_data):
        """Execute AL iteration in service mode (local only)"""
        logger.info(f"🤖 Executing AL iteration {iteration_number} in service mode")
        
        try:
            # Update config with signal data if provided
            iteration_config = {
                **self.config,
                "iteration": iteration_number,
                "project_id": self.project_id,
                **signal_data.get('config_override', {})
            }
            
            # Save iteration config
            config_file = self.work_dir / f"iteration_{iteration_number}_config.json"
            with open(config_file, 'w') as f:
                json.dump(iteration_config, f, indent=2)
            
            # Execute the iteration locally
            result = self._run_local_iteration(iteration_number, config_file)
            
            logger.info(f"✅ AL iteration {iteration_number} completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"❌ AL iteration {iteration_number} failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'iteration': iteration_number
            }

    def _send_result_to_dal(self, iteration_number, result):
        """Send iteration result back to DAL"""
        result_file = self.signal_dir / f"iteration_{iteration_number}_result.json"
        
        try:
            result_data = {
                'iteration': iteration_number,
                'timestamp': time.time(),
                'project_id': self.project_id,
                'result': result
            }
            
            with open(result_file, 'w') as f:
                json.dump(result_data, f, indent=2)
            
            logger.info(f"📤 Sent iteration {iteration_number} result to DAL: {result_file}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send result to DAL: {e}")

    def _cleanup_signal(self, signal_file):
        """Remove processed signal file"""
        try:
            signal_file.unlink()
            logger.debug(f"🗑️ Cleaned up signal file: {signal_file}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to cleanup signal file: {e}")

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"📡 Received signal {signum}, shutting down gracefully...")
        self.running = False

    def cleanup(self):
        """Clean up temporary files"""
        logger.info("Cleaning up AL-Engine resources")
        # Implementation depends on cleanup strategy

def main():
    parser = argparse.ArgumentParser(description="AL-Engine - Active Learning Engine (Local execution only)")
    parser.add_argument('--project_id', type=str, help='Project identifier (required for non-server modes)')
    parser.add_argument('--config', type=str, help='AL configuration file (required for non-server modes)')
    parser.add_argument('--iteration', type=int, help='Run specific iteration (default: run all)')
    parser.add_argument('--workflow', action='store_true', help='Run full workflow')
    parser.add_argument('--service', action='store_true', help='Run in service mode (wait for DAL signals)')
    parser.add_argument('--server', action='store_true', help='Run HTTP API server mode')
    parser.add_argument('--port', type=int, default=5050, help='API server port (default: 5050)')
    
    args = parser.parse_args()
    
    # Validate required arguments for non-server modes
    if not args.server and (not args.project_id or not args.config):
        parser.error("--project_id and --config are required for non-server modes")
    
    try:
        if args.server:
            # Run HTTP API server mode
            logger.info("🚀 Starting AL-Engine in HTTP API server mode...")
            server = ALEngineServer(port=args.port)
            server.start_server()
        else:
            # Initialize legacy AL-Engine
            engine = ALEngine(args.project_id, args.config)
            
            if args.service:
                # Run in service mode - wait for DAL signals
                logger.info("🚀 Starting AL-Engine in file-based service mode...")
                engine.start_service_mode()
            elif args.iteration:
                # Run specific iteration
                result = engine.run_iteration(args.iteration)
                logger.info(f"Iteration {args.iteration} result: {result}")
            elif args.workflow:
                # Run full workflow
                results = engine.run_full_workflow()
                logger.info(f"Workflow completed with {len(results)} iterations")
            else:
                logger.error("Please specify --iteration, --workflow, --service, or --server")
                print("\nUsage examples:")
                print(f"  # HTTP API server mode (recommended):")
                print(f"  python main.py --server --port 5050")
                print(f"  ")
                print(f"  # File-based service mode:")
                print(f"  python main.py --project_id <addr> --config <config.json> --service")
                print(f"  ")
                print(f"  # One-shot execution:")
                print(f"  python main.py --project_id <addr> --config <config.json> --iteration 1")
                sys.exit(1)
            
    except Exception as e:
        logger.error(f"AL-Engine failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 