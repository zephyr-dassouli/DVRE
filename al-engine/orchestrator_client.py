# orchestrator_client.py - Orchestrator Communication Client

import requests
import json
import time
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class OrchestratorClient:
    def __init__(self, orchestrator_url=None):
        """
        Initialize orchestrator client
        
        Args:
            orchestrator_url (str): Base URL of the orchestration server
        """
        self.orchestrator_url = orchestrator_url or "http://145.100.135.97:5004"
        self.session = requests.Session()
        self.timeout = 30  # seconds
        
        logger.info(f"Orchestrator client initialized for {self.orchestrator_url}")

    def submit_al_iteration(self, project_id, iteration_number, config_file):
        """
        Submit AL iteration job to orchestrator
        
        Args:
            project_id (str): Project identifier
            iteration_number (int): Current iteration number
            config_file (str): Path to configuration file
            
        Returns:
            str: Job ID for tracking
        """
        logger.info(f"Submitting AL iteration {iteration_number} for project {project_id}")
        
        try:
            # Read configuration
            with open(config_file, 'r') as f:
                config = json.load(f)
            
            # Prepare job submission payload
            payload = {
                "project_id": project_id,
                "iteration": iteration_number,
                "workflow_type": "active_learning",
                "configuration": config,
                "computation_phase": "iteration"
            }
            
            # Submit job
            response = self.session.post(
                f"{self.orchestrator_url}/api/jobs/submit",
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                job_data = response.json()
                job_id = job_data.get('job_id')
                logger.info(f"Job submitted successfully: {job_id}")
                return job_id
            else:
                logger.error(f"Job submission failed: {response.status_code} - {response.text}")
                raise Exception(f"Orchestrator submission failed: {response.text}")
                
        except Exception as e:
            logger.error(f"Failed to submit AL iteration: {e}")
            raise

    def wait_for_completion(self, job_id, max_wait_time=3600, poll_interval=30):
        """
        Wait for job completion and download results
        
        Args:
            job_id (str): Job identifier
            max_wait_time (int): Maximum wait time in seconds
            poll_interval (int): Polling interval in seconds
            
        Returns:
            dict: Job result with output files
        """
        logger.info(f"Waiting for job completion: {job_id}")
        
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            try:
                status = self.get_job_status(job_id)
                
                if status['state'] == 'completed':
                    logger.info(f"Job {job_id} completed successfully")
                    return self.download_results(job_id)
                elif status['state'] == 'failed':
                    logger.error(f"Job {job_id} failed: {status.get('error', 'Unknown error')}")
                    raise Exception(f"Job failed: {status.get('error')}")
                elif status['state'] in ['running', 'queued', 'pending']:
                    logger.info(f"Job {job_id} status: {status['state']}")
                    time.sleep(poll_interval)
                else:
                    logger.warning(f"Unknown job status: {status['state']}")
                    time.sleep(poll_interval)
                    
            except Exception as e:
                logger.error(f"Error checking job status: {e}")
                time.sleep(poll_interval)
        
        raise Exception(f"Job {job_id} did not complete within {max_wait_time} seconds")

    def get_job_status(self, job_id):
        """
        Get current job status
        
        Args:
            job_id (str): Job identifier
            
        Returns:
            dict: Job status information
        """
        try:
            response = self.session.get(
                f"{self.orchestrator_url}/api/jobs/{job_id}/status",
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get job status: {response.status_code}")
                return {'state': 'unknown'}
                
        except Exception as e:
            logger.error(f"Error getting job status: {e}")
            return {'state': 'unknown'}

    def download_results(self, job_id):
        """
        Download job results
        
        Args:
            job_id (str): Job identifier
            
        Returns:
            dict: Downloaded result files
        """
        logger.info(f"Downloading results for job {job_id}")
        
        try:
            # Get list of output files
            response = self.session.get(
                f"{self.orchestrator_url}/api/jobs/{job_id}/outputs",
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to get output list: {response.text}")
            
            outputs = response.json()
            downloaded_files = {}
            
            # Download each output file
            for output_name, output_info in outputs.items():
                file_url = output_info.get('download_url')
                if file_url:
                    file_path = self._download_file(file_url, output_name)
                    downloaded_files[output_name] = file_path
            
            logger.info(f"Downloaded {len(downloaded_files)} result files")
            return {
                'success': True,
                'outputs': downloaded_files,
                'job_id': job_id
            }
            
        except Exception as e:
            logger.error(f"Failed to download results: {e}")
            return {
                'success': False,
                'error': str(e),
                'job_id': job_id
            }

    def _download_file(self, file_url, output_name):
        """
        Download a single file
        
        Args:
            file_url (str): URL to download from
            output_name (str): Output file name
            
        Returns:
            Path: Path to downloaded file
        """
        try:
            response = self.session.get(file_url, timeout=self.timeout)
            response.raise_for_status()
            
            # Save to local file
            output_path = Path(f"./{output_name}")
            with open(output_path, 'wb') as f:
                f.write(response.content)
            
            logger.info(f"Downloaded {output_name} to {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Failed to download {output_name}: {e}")
            raise

    def check_orchestrator_health(self):
        """
        Check if orchestrator is healthy and reachable
        
        Returns:
            bool: True if orchestrator is healthy
        """
        try:
            response = self.session.get(
                f"{self.orchestrator_url}/api/health",
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                health_data = response.json()
                logger.info(f"Orchestrator health: {health_data.get('status', 'unknown')}")
                return health_data.get('status') == 'healthy'
            else:
                logger.warning(f"Orchestrator health check failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.warning(f"Orchestrator health check error: {e}")
            return False

    def list_jobs(self, project_id=None):
        """
        List jobs for a project
        
        Args:
            project_id (str, optional): Filter by project ID
            
        Returns:
            list: List of jobs
        """
        try:
            params = {}
            if project_id:
                params['project_id'] = project_id
            
            response = self.session.get(
                f"{self.orchestrator_url}/api/jobs",
                params=params,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to list jobs: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error listing jobs: {e}")
            return []

    def cancel_job(self, job_id):
        """
        Cancel a running job
        
        Args:
            job_id (str): Job identifier
            
        Returns:
            bool: True if cancellation successful
        """
        try:
            response = self.session.delete(
                f"{self.orchestrator_url}/api/jobs/{job_id}",
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                logger.info(f"Job {job_id} cancelled successfully")
                return True
            else:
                logger.error(f"Failed to cancel job: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error cancelling job: {e}")
            return False 