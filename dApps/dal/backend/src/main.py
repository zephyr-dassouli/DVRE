"""
DAL Backend - FastAPI application for orchestrating Active Learning workflows
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .cwl_interpreter import CWLInterpreter
from .al_coordinator import ALCoordinator
from .dvre_client import DVREClient
from .blockchain_client import BlockchainClient
from .models import (
    WorkflowRequest, 
    ProjectStatus, 
    LabelSubmission, 
    WorkflowConfig
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global services
services = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup services"""
    logger.info("Initializing DAL Backend services...")
    
    # Initialize services
    services['cwl_interpreter'] = CWLInterpreter()
    services['al_coordinator'] = ALCoordinator()
    services['dvre_client'] = DVREClient(
        base_url=os.getenv('DVRE_API_URL', 'http://dvre-server:8000')
    )
    services['blockchain_client'] = BlockchainClient(
        rpc_url=os.getenv('BLOCKCHAIN_RPC_URL', 'http://localhost:8545')
    )
    
    # Setup data directory
    dal_data_path = Path(os.getenv('DAL_DATA_PATH', '/dal_data'))
    dal_data_path.mkdir(exist_ok=True)
    services['data_path'] = dal_data_path
    
    logger.info("DAL Backend services initialized successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down DAL Backend services...")
    if 'blockchain_client' in services:
        await services['blockchain_client'].close()

# Create FastAPI app
app = FastAPI(
    title="DAL Backend API",
    description="Decentralized Active Learning Backend for DVRE Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration"""
    return {
        "status": "healthy",
        "service": "dal-backend",
        "version": "1.0.0"
    }

# Project management endpoints
@app.post("/api/projects/{project_id}/start-workflow")
async def start_workflow(
    project_id: str, 
    request: WorkflowRequest, 
    background_tasks: BackgroundTasks
):
    """Start an Active Learning workflow for a project"""
    try:
        logger.info(f"Starting workflow for project {project_id}")
        
        # Validate project exists in DVRE
        dvre_client = services['dvre_client']
        project_info = await dvre_client.get_project(project_id)
        
        if not project_info:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Setup project directory
        project_dir = services['data_path'] / project_id
        project_dir.mkdir(exist_ok=True)
        
        # Initialize project status
        await update_project_status(project_id, 'initializing', 'setup')
        
        # Start workflow execution in background
        background_tasks.add_task(
            execute_workflow, 
            project_id, 
            request.workflow_config,
            project_info
        )
        
        return {
            "status": "started",
            "project_id": project_id,
            "workflow_type": request.workflow_type,
            "message": "Workflow execution started"
        }
        
    except Exception as e:
        logger.error(f"Failed to start workflow for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects/{project_id}/status")
async def get_project_status(project_id: str) -> ProjectStatus:
    """Get the current status of a project's workflow"""
    try:
        # Read status from project directory
        status_file = services['data_path'] / project_id / 'status.json'
        
        if not status_file.exists():
            return ProjectStatus(
                project_id=project_id,
                phase='not_started',
                current_step='',
                progress=0,
                results=[],
                error=None
            )
        
        import json
        with open(status_file, 'r') as f:
            status_data = json.load(f)
        
        return ProjectStatus(**status_data)
        
    except Exception as e:
        logger.error(f"Failed to get status for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/projects/{project_id}/submit-labels")
async def submit_labels(project_id: str, submission: LabelSubmission):
    """Submit user labels for queried samples"""
    try:
        logger.info(f"Submitting labels for project {project_id}")
        
        # Save labels to project directory
        project_dir = services['data_path'] / project_id
        labels_file = project_dir / 'user_labels.json'
        
        import json
        with open(labels_file, 'w') as f:
            json.dump(submission.dict(), f)
        
        # Signal that labels are ready
        signal_file = project_dir / 'labels_ready.signal'
        signal_file.touch()
        
        await update_project_status(project_id, 'running', 'processing_labels')
        
        return {
            "status": "success",
            "project_id": project_id,
            "labels_count": len(submission.labels),
            "message": "Labels submitted successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to submit labels for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Workflow execution
async def execute_workflow(
    project_id: str, 
    config: WorkflowConfig, 
    project_info: Dict
):
    """Execute the Active Learning workflow"""
    try:
        logger.info(f"Executing workflow for project {project_id}")
        
        cwl_interpreter = services['cwl_interpreter']
        al_coordinator = services['al_coordinator']
        
        # Load CWL workflow
        workflow_path = Path(__file__).parent.parent / 'workflows' / 'active_learning.cwl'
        workflow = await cwl_interpreter.load_workflow(workflow_path)
        
        # Execute workflow steps
        for step in workflow.get('steps', []):
            step_name = step.get('id', 'unknown_step')
            await update_project_status(project_id, 'running', step_name)
            
            logger.info(f"Executing step: {step_name}")
            
            if step_name == 'upload_dataset':
                await handle_dataset_upload(project_id, step.get('inputs', {}))
                
            elif step_name == 'train_initial_model':
                await al_coordinator.trigger_training(
                    project_id, 
                    'train', 
                    step.get('inputs', {})
                )
                
            elif step_name == 'query_selection':
                await al_coordinator.trigger_query_selection(
                    project_id,
                    config.strategy,
                    config.n_queries
                )
                
            elif step_name == 'collect_labels':
                await wait_for_user_labels(project_id)
                
            elif step_name == 'retrain_model':
                await al_coordinator.trigger_retraining(project_id)
                
            elif step_name == 'commit_results':
                await commit_to_blockchain(project_id, step.get('inputs', {}))
        
        await update_project_status(project_id, 'completed', 'finished')
        logger.info(f"Workflow completed for project {project_id}")
        
    except Exception as e:
        logger.error(f"Workflow execution failed for project {project_id}: {e}")
        await update_project_status(project_id, 'failed', 'error', error=str(e))

# Helper functions
async def update_project_status(
    project_id: str, 
    phase: str, 
    current_step: str, 
    progress: int = 0,
    error: Optional[str] = None
):
    """Update project status"""
    status = {
        "project_id": project_id,
        "phase": phase,
        "current_step": current_step,
        "progress": progress,
        "results": [],
        "error": error,
        "updated_at": asyncio.get_event_loop().time()
    }
    
    status_file = services['data_path'] / project_id / 'status.json'
    status_file.parent.mkdir(exist_ok=True)
    
    import json
    with open(status_file, 'w') as f:
        json.dump(status, f, indent=2)

async def handle_dataset_upload(project_id: str, inputs: Dict):
    """Handle dataset upload step"""
    # Implementation for dataset handling
    logger.info(f"Handling dataset upload for project {project_id}")

async def wait_for_user_labels(project_id: str):
    """Wait for user to submit labels"""
    signal_file = services['data_path'] / project_id / 'labels_ready.signal'
    
    while not signal_file.exists():
        await asyncio.sleep(1)
    
    # Remove signal file
    signal_file.unlink()

async def commit_to_blockchain(project_id: str, inputs: Dict):
    """Commit results to blockchain"""
    blockchain_client = services['blockchain_client']
    # Implementation for blockchain commitment
    logger.info(f"Committing results to blockchain for project {project_id}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    ) 