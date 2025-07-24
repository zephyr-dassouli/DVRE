#!/usr/bin/env python3
"""
Standalone DVRE Orchestration Server

Two-Phase Active Learning Orchestration:
Phase 1: Configuration & Setup (CWL workflow deployment)
Phase 2: Runtime Orchestration (AL-engine communication)
"""

import json
import subprocess
import tempfile
import os
import uuid
from flask import Flask, request, jsonify
import threading
import time
from datetime import datetime

app = Flask(__name__)

# In-memory storage for workflow states
workflow_db = {}

# In-memory storage for AL engine sessions (Phase 2)
al_sessions_db = {}
al_commands_db = {}

def validate_cwl_workflow(cwl_workflow):
    """Basic CWL workflow validation"""
    try:
        if isinstance(cwl_workflow, str):
            cwl_data = json.loads(cwl_workflow)
        else:
            cwl_data = cwl_workflow
            
        # Check required CWL fields
        required_fields = ['cwlVersion', 'class']
        for field in required_fields:
            if field not in cwl_data:
                return False
                
        # Validate CWL version
        if cwl_data.get('cwlVersion') not in ['v1.0', 'v1.1', 'v1.2']:
            return False
            
        # Validate class
        if cwl_data.get('class') not in ['Workflow', 'CommandLineTool', 'ExpressionTool']:
            return False
            
        return True
    except:
        return False

def poll_workflow(workflow_id):
    """Poll workflow status in a separate thread"""
    workflow = workflow_db.get(workflow_id)
    if not workflow or not workflow["process"]:
        return

    proc = workflow["process"]
    if proc.poll() is not None:  # Process has finished
        stdout, stderr = proc.communicate()
        if proc.returncode == 0:
            workflow["status"] = "COMPLETED"
            workflow["output"] = stdout
        else:
            workflow["status"] = "FAILED"
            workflow["error"] = stderr
        
        workflow["completed_at"] = datetime.now().isoformat()
        
        # Clean up temporary files
        try:
            if workflow.get("cwl_path"):
                os.remove(workflow["cwl_path"])
            if workflow.get("inputs_path"):
                os.remove(workflow["inputs_path"])
        except:
            pass
    else:
        # Reschedule the poller
        threading.Timer(1.0, poll_workflow, args=[workflow_id]).start()

# ============================================================================
# PHASE 1: Configuration & Setup (CWL Workflow Management)
# ============================================================================

@app.route('/streamflow/submit', methods=['POST'])
def submit_workflow():
    """Submit a basic workflow (backward compatibility)"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    cwl_workflow = data.get('cwl_workflow')
    inputs = data.get('inputs', {})

    if not cwl_workflow:
        return jsonify({"error": "cwl_workflow is required"}), 400

    # Generate workflow ID
    workflow_id = str(uuid.uuid4())
    
    workflow_db[workflow_id] = {
        "workflow_id": workflow_id,
        "cwl_workflow": cwl_workflow,
        "inputs": inputs,
        "status": "PENDING",
        "created_at": datetime.now().isoformat(),
        "process": None,
        "output": None,
        "error": None,
        "phase": "basic"
    }

    start_workflow_execution(workflow_id)
    
    return jsonify({
        "workflow_id": workflow_id,
        "status": "SUBMITTED"
    })

@app.route('/streamflow/submit-project-workflow', methods=['POST'])
def submit_project_workflow():
    """
    Submit a project-specific CWL workflow with full metadata (Phase 1)
    This finalizes the configuration phase and prepares for runtime orchestration
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    project_id = data.get('project_id')
    cwl_workflow = data.get('cwl_workflow')
    inputs = data.get('inputs', {})
    metadata = data.get('metadata', {})

    # Validation
    if not project_id:
        return jsonify({"error": "project_id is required"}), 400
    if not cwl_workflow:
        return jsonify({"error": "cwl_workflow is required"}), 400

    # Validate CWL workflow structure
    if not validate_cwl_workflow(cwl_workflow):
        return jsonify({"error": "Invalid CWL workflow format"}), 400

    # Generate workflow ID
    workflow_id = str(uuid.uuid4())
    
    # Store workflow with project context
    workflow_db[workflow_id] = {
        "workflow_id": workflow_id,
        "project_id": project_id,
        "cwl_workflow": cwl_workflow,
        "inputs": inputs,
        "metadata": {
            "creator": metadata.get('creator'),
            "project_title": metadata.get('project_title'),
            "al_config": metadata.get('al_config', {}),
            "contributors": metadata.get('contributors', []),
            "configuration_phase": metadata.get('configuration_phase', 'finalized'),
            "smart_contract_address": metadata.get('smart_contract_address'),
            "ipfs_dataset_hash": metadata.get('ipfs_dataset_hash'),
            "ipfs_model_hash": metadata.get('ipfs_model_hash'),
            "created_at": datetime.now().isoformat(),
            **metadata
        },
        "status": "PENDING",
        "created_at": datetime.now().isoformat(),
        "process": None,
        "output": None,
        "error": None,
        "phase": "configuration_complete"
    }

    # Start execution (Phase 1 complete, ready for Phase 2)
    start_project_workflow_execution(workflow_id)
    
    return jsonify({
        "workflow_id": workflow_id,
        "project_id": project_id,
        "status": "SUBMITTED",
        "message": "Project workflow submitted successfully. Ready for runtime orchestration.",
        "phase": "configuration_complete"
    })

def start_workflow_execution(workflow_id):
    """Start basic workflow execution (backward compatibility)"""
    workflow = workflow_db.get(workflow_id)
    if not workflow:
        return

    # Create temporary files for CWL and inputs
    with tempfile.NamedTemporaryFile(mode='w', suffix='.cwl', delete=False) as cwl_file:
        cwl_file.write(workflow["cwl_workflow"])
        workflow["cwl_path"] = cwl_file.name

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as inputs_file:
        json.dump(workflow["inputs"], inputs_file)
        workflow["inputs_path"] = inputs_file.name

    # Mock execution command
    command = [
        "echo", 
        f"Executing workflow {workflow_id} with CWL: {workflow['cwl_path']} and inputs: {workflow['inputs_path']}"
    ]
    
    try:
        proc = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        workflow["process"] = proc
        workflow["status"] = "RUNNING"
        
        # Start polling in a separate thread
        threading.Timer(0.1, poll_workflow, args=[workflow_id]).start()
        
    except Exception as e:
        workflow["status"] = "FAILED"
        workflow["error"] = str(e)

def start_project_workflow_execution(workflow_id):
    """Start project-specific workflow execution with enhanced logging (Phase 1 → Phase 2 transition)"""
    workflow = workflow_db.get(workflow_id)
    if not workflow:
        return

    # Create temporary files for CWL and inputs
    with tempfile.NamedTemporaryFile(mode='w', suffix='.cwl', delete=False) as cwl_file:
        if isinstance(workflow["cwl_workflow"], str):
            cwl_file.write(workflow["cwl_workflow"])
        else:
            json.dump(workflow["cwl_workflow"], cwl_file, indent=2)
        workflow["cwl_path"] = cwl_file.name

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as inputs_file:
        json.dump(workflow["inputs"], inputs_file)
        workflow["inputs_path"] = inputs_file.name

    # Enhanced mock execution for AL workflow (Phase 1 complete)
    project_info = f"Project: {workflow.get('project_id', 'unknown')}"
    creator_info = f"Creator: {workflow['metadata'].get('creator', 'unknown')}"
    al_config = workflow['metadata'].get('al_config', {})
    al_info = f"AL Strategy: {al_config.get('query_strategy', 'uncertainty_sampling')}"
    phase_info = f"Phase: {workflow.get('phase', 'unknown')} - Configuration finalized, ready for runtime orchestration"
    
    command = [
        "bash", "-c",
        f"echo 'DVRE Active Learning Workflow - Phase 1 Complete'; "
        f"echo '{project_info}'; "
        f"echo '{creator_info}'; "
        f"echo '{al_info}'; "
        f"echo '{phase_info}'; "
        f"echo 'CWL: {workflow['cwl_path']}'; "
        f"echo 'Inputs: {workflow['inputs_path']}'; "
        f"sleep 2; "
        f"echo 'Workflow {workflow_id} ready for Phase 2 runtime orchestration'"
    ]
    
    try:
        proc = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        workflow["process"] = proc
        workflow["status"] = "RUNNING"
        workflow["started_at"] = datetime.now().isoformat()
        
        # Start polling in a separate thread
        threading.Timer(0.1, poll_workflow, args=[workflow_id]).start()
        
    except Exception as e:
        workflow["status"] = "FAILED"
        workflow["error"] = str(e)

# ============================================================================
# PHASE 2: Runtime Orchestration (AL-engine Communication)
# ============================================================================

@app.route('/al-engine/command', methods=['POST'])
def al_engine_command():
    """
    Send commands to AL-engine for runtime orchestration (Phase 2)
    Commands: start_querying, continue_querying, prompt_training, submit_labels, terminate_project
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    command_type = data.get('command_type')
    project_id = data.get('project_id')
    workflow_id = data.get('workflow_id')
    parameters = data.get('parameters', {})
    timestamp = data.get('timestamp')

    # Validation
    if not command_type:
        return jsonify({"error": "command_type is required"}), 400
    if not project_id:
        return jsonify({"error": "project_id is required"}), 400
    if not workflow_id:
        return jsonify({"error": "workflow_id is required"}), 400

    # Verify workflow exists and is in correct phase
    workflow = workflow_db.get(workflow_id)
    if not workflow:
        return jsonify({"error": "Workflow not found"}), 404
    
    if workflow.get('phase') != 'configuration_complete':
        return jsonify({"error": "Workflow not ready for runtime orchestration"}), 400

    # Generate command ID
    command_id = str(uuid.uuid4())
    
    # Process the command based on type
    try:
        if command_type == 'start_querying':
            response = handle_start_querying(command_id, project_id, workflow_id, parameters)
        elif command_type == 'continue_querying':
            response = handle_continue_querying(command_id, project_id, workflow_id, parameters)
        elif command_type == 'prompt_training':
            response = handle_prompt_training(command_id, project_id, workflow_id, parameters)
        elif command_type == 'submit_labels':
            response = handle_submit_labels(command_id, project_id, workflow_id, parameters)
        elif command_type == 'terminate_project':
            response = handle_terminate_project(command_id, project_id, workflow_id, parameters)
        else:
            return jsonify({"error": f"Unknown command_type: {command_type}"}), 400
            
        # Store command for tracking
        al_commands_db[command_id] = {
            "command_id": command_id,
            "command_type": command_type,
            "project_id": project_id,
            "workflow_id": workflow_id,
            "parameters": parameters,
            "timestamp": timestamp,
            "response": response,
            "created_at": datetime.now().isoformat()
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({
            "command_id": command_id,
            "status": "failed",
            "message": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

def handle_start_querying(command_id, project_id, workflow_id, parameters):
    """Handle start_querying command - initiate new AL querying session"""
    query_count = parameters.get('query_count', 10)
    strategy_override = parameters.get('strategy_override')
    
    # Create new querying session
    session_id = str(uuid.uuid4())
    
    session = {
        "session_id": session_id,
        "project_id": project_id,
        "workflow_id": workflow_id,
        "status": "active",
        "current_round": 1,
        "total_rounds": parameters.get('max_rounds', 10),
        "queried_samples": [],
        "accuracy_metrics": {},
        "created_at": datetime.now().isoformat(),
        "query_count": query_count,
        "strategy": strategy_override or "uncertainty_sampling"
    }
    
    # Store session
    if project_id not in al_sessions_db:
        al_sessions_db[project_id] = {}
    al_sessions_db[project_id][session_id] = session
    
    # Mock AL-engine communication
    print(f"AL-Engine: Starting querying session {session_id} for project {project_id}")
    print(f"AL-Engine: Query strategy: {session['strategy']}, Count: {query_count}")
    
    # Simulate querying process
    mock_samples = [
        {"sample_id": f"sample_{i}", "data": f"mock_data_{i}", "uncertainty": 0.8 + (i * 0.01)}
        for i in range(query_count)
    ]
    session["queried_samples"] = mock_samples
    session["status"] = "waiting_for_labels"
    
    return {
        "command_id": command_id,
        "status": "accepted",
        "message": f"Querying session started successfully",
        "data": {
            "session_id": session_id,
            "queried_samples": mock_samples,
            "query_count": len(mock_samples)
        },
        "timestamp": datetime.now().isoformat()
    }

def handle_continue_querying(command_id, project_id, workflow_id, parameters):
    """Handle continue_querying command - continue existing session"""
    session_id = parameters.get('session_id')
    if not session_id:
        raise ValueError("session_id is required for continue_querying")
    
    # Get existing session
    session = al_sessions_db.get(project_id, {}).get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found for project {project_id}")
    
    if session['status'] != 'waiting_for_labels':
        raise ValueError(f"Session {session_id} is not ready for querying (status: {session['status']})")
    
    # Move to next round
    session['current_round'] += 1
    session['status'] = 'active'
    
    # Mock continued querying
    query_count = session.get('query_count', 10)
    mock_samples = [
        {"sample_id": f"sample_r{session['current_round']}_{i}", "data": f"mock_data_r{session['current_round']}_{i}", "uncertainty": 0.7 + (i * 0.02)}
        for i in range(query_count)
    ]
    session["queried_samples"] = mock_samples
    session["status"] = "waiting_for_labels"
    
    print(f"AL-Engine: Continuing querying session {session_id}, round {session['current_round']}")
    
    return {
        "command_id": command_id,
        "status": "accepted",
        "message": f"Querying continued for round {session['current_round']}",
        "data": {
            "session_id": session_id,
            "current_round": session['current_round'],
            "queried_samples": mock_samples,
            "query_count": len(mock_samples)
        },
        "timestamp": datetime.now().isoformat()
    }

def handle_prompt_training(command_id, project_id, workflow_id, parameters):
    """Handle prompt_training command - trigger model training"""
    session_id = parameters.get('session_id')
    training_config = parameters.get('training_config', {})
    
    if not session_id:
        raise ValueError("session_id is required for prompt_training")
    
    # Get existing session
    session = al_sessions_db.get(project_id, {}).get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found for project {project_id}")
    
    # Update session status
    session['status'] = 'training'
    session['last_training'] = datetime.now().isoformat()
    
    # Mock training process
    print(f"AL-Engine: Starting training for session {session_id}")
    print(f"AL-Engine: Training config: {training_config}")
    
    # Simulate training completion and accuracy improvement
    current_accuracy = session['accuracy_metrics'].get('accuracy', 0.70)
    new_accuracy = min(0.95, current_accuracy + 0.02)  # Simulate improvement
    
    session['accuracy_metrics'] = {
        'accuracy': new_accuracy,
        'precision': new_accuracy + 0.01,
        'recall': new_accuracy - 0.01,
        'f1_score': new_accuracy,
        'training_time': 45.2,
        'round': session['current_round']
    }
    
    session['status'] = 'active'  # Ready for next round
    
    return {
        "command_id": command_id,
        "status": "completed",
        "message": "Training completed successfully",
        "data": {
            "session_id": session_id,
            "accuracy_metrics": session['accuracy_metrics'],
            "training_completed": True
        },
        "timestamp": datetime.now().isoformat()
    }

def handle_submit_labels(command_id, project_id, workflow_id, parameters):
    """Handle submit_labels command - process new labeled data"""
    session_id = parameters.get('session_id')
    labeled_samples = parameters.get('labeled_samples', [])
    
    if not session_id:
        raise ValueError("session_id is required for submit_labels")
    
    # Get existing session
    session = al_sessions_db.get(project_id, {}).get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found for project {project_id}")
    
    # Process labeled samples
    if 'labeled_data' not in session:
        session['labeled_data'] = []
    
    session['labeled_data'].extend(labeled_samples)
    session['total_labeled_samples'] = len(session['labeled_data'])
    session['last_labeling'] = datetime.now().isoformat()
    
    print(f"AL-Engine: Received {len(labeled_samples)} labeled samples for session {session_id}")
    print(f"AL-Engine: Total labeled samples: {session['total_labeled_samples']}")
    
    # Check if ready for next phase
    if session['status'] == 'waiting_for_labels':
        session['status'] = 'active'  # Ready for training or next query
    
    return {
        "command_id": command_id,
        "status": "accepted",
        "message": f"Processed {len(labeled_samples)} labeled samples",
        "data": {
            "session_id": session_id,
            "processed_samples": len(labeled_samples),
            "total_labeled_samples": session['total_labeled_samples'],
            "session_status": session['status']
        },
        "timestamp": datetime.now().isoformat()
    }

def handle_terminate_project(command_id, project_id, workflow_id, parameters):
    """Handle terminate_project command - clean up and finalize"""
    # Clean up all sessions for this project
    sessions_removed = 0
    if project_id in al_sessions_db:
        sessions_removed = len(al_sessions_db[project_id])
        del al_sessions_db[project_id]
    
    # Update workflow status
    workflow = workflow_db.get(workflow_id)
    if workflow:
        workflow['status'] = 'TERMINATED'
        workflow['terminated_at'] = datetime.now().isoformat()
        workflow['phase'] = 'terminated'
    
    print(f"AL-Engine: Terminating project {project_id}, removed {sessions_removed} sessions")
    
    return {
        "command_id": command_id,
        "status": "completed",
        "message": f"Project {project_id} terminated successfully",
        "data": {
            "project_id": project_id,
            "workflow_id": workflow_id,
            "sessions_removed": sessions_removed,
            "terminated_at": datetime.now().isoformat()
        },
        "timestamp": datetime.now().isoformat()
    }

@app.route('/al-engine/sessions/<project_id>', methods=['GET'])
def list_querying_sessions(project_id):
    """List all active querying sessions for a project"""
    sessions = al_sessions_db.get(project_id, {})
    session_list = [
        {
            "session_id": session_id,
            "status": session_data["status"],
            "current_round": session_data["current_round"],
            "total_rounds": session_data["total_rounds"],
            "created_at": session_data["created_at"],
            "accuracy_metrics": session_data.get("accuracy_metrics", {})
        }
        for session_id, session_data in sessions.items()
    ]
    
    return jsonify({
        "project_id": project_id,
        "sessions": session_list,
        "total_sessions": len(session_list)
    })

@app.route('/al-engine/sessions/<project_id>/<session_id>', methods=['GET'])
def get_querying_session(project_id, session_id):
    """Get detailed information about a specific querying session"""
    session = al_sessions_db.get(project_id, {}).get(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    return jsonify(session)

# ============================================================================
# Status and Monitoring Endpoints
# ============================================================================

@app.route('/streamflow/status/<workflow_id>', methods=['GET'])
def get_workflow_status(workflow_id):
    """Get workflow status with enhanced project information"""
    workflow = workflow_db.get(workflow_id)
    if not workflow:
        return jsonify({"error": "Workflow not found"}), 404
    
    response = {
        "workflow_id": workflow_id,
        "status": workflow["status"],
        "created_at": workflow["created_at"],
        "output": workflow.get("output"),
        "error": workflow.get("error"),
        "phase": workflow.get("phase", "unknown")
    }
    
    # Include project-specific information if available
    if "project_id" in workflow:
        response["project_id"] = workflow["project_id"]
        response["metadata"] = workflow.get("metadata", {})
        
        # Include AL session information if available
        project_id = workflow["project_id"]
        if project_id in al_sessions_db:
            response["active_sessions"] = len(al_sessions_db[project_id])
            response["sessions"] = list(al_sessions_db[project_id].keys())
        
    if "started_at" in workflow:
        response["started_at"] = workflow["started_at"]
    if "completed_at" in workflow:
        response["completed_at"] = workflow["completed_at"]
    if "terminated_at" in workflow:
        response["terminated_at"] = workflow["terminated_at"]
        
    return jsonify(response)

@app.route('/streamflow/workflows', methods=['GET'])
def list_workflows():
    """List all workflows with project information"""
    project_filter = request.args.get('project_id')
    
    workflows = []
    for wid, workflow in workflow_db.items():
        # Filter by project if requested
        if project_filter and workflow.get('project_id') != project_filter:
            continue
            
        workflow_info = {
            "workflow_id": wid,
            "status": workflow["status"],
            "created_at": workflow["created_at"],
            "phase": workflow.get("phase", "unknown")
        }
        
        # Include project info if available
        if "project_id" in workflow:
            workflow_info["project_id"] = workflow["project_id"]
            workflow_info["project_title"] = workflow.get("metadata", {}).get("project_title")
            
            # Include session count
            project_id = workflow["project_id"]
            if project_id in al_sessions_db:
                workflow_info["active_sessions"] = len(al_sessions_db[project_id])
            
        workflows.append(workflow_info)
    
    return jsonify({"workflows": workflows})

@app.route('/streamflow/projects/<project_id>/workflows', methods=['GET'])
def get_project_workflows(project_id):
    """Get all workflows for a specific project"""
    project_workflows = []
    
    for wid, workflow in workflow_db.items():
        if workflow.get('project_id') == project_id:
            workflow_info = {
                "workflow_id": wid,
                "status": workflow["status"],
                "created_at": workflow["created_at"],
                "metadata": workflow.get("metadata", {}),
                "phase": workflow.get("phase", "unknown")
            }
            
            # Include session information
            if project_id in al_sessions_db:
                workflow_info["active_sessions"] = len(al_sessions_db[project_id])
                workflow_info["sessions"] = list(al_sessions_db[project_id].keys())
            
            project_workflows.append(workflow_info)
    
    return jsonify({
        "project_id": project_id,
        "workflows": project_workflows,
        "total_count": len(project_workflows),
        "active_sessions": len(al_sessions_db.get(project_id, {}))
    })

@app.route('/', methods=['GET'])
def home():
    """Home page with API documentation"""
    return jsonify({
        "message": "DVRE Orchestration Server - Two-Phase Active Learning",
        "description": "Phase 1: Configuration & Setup | Phase 2: Runtime Orchestration",
        "endpoints": {
            "Phase 1 - Configuration": {
                "POST /streamflow/submit-project-workflow": "Submit and finalize CWL workflow configuration",
                "GET /streamflow/status/<id>": "Get workflow status",
                "GET /streamflow/workflows": "List all workflows"
            },
            "Phase 2 - Runtime Orchestration": {
                "POST /al-engine/command": "Send commands to AL-engine (start_querying, continue_querying, prompt_training, submit_labels, terminate_project)",
                "GET /al-engine/sessions/<project_id>": "List active querying sessions",
                "GET /al-engine/sessions/<project_id>/<session_id>": "Get session details"
            },
            "Monitoring": {
                "GET /": "This help page",
                "GET /streamflow/projects/<project_id>/workflows": "Get project workflows and sessions"
            }
        },
        "workflow_phases": {
            "Phase 1": "Configuration & Setup (CWL deployment, smart contracts, IPFS uploads)",
            "Phase 2": "Runtime Orchestration (AL querying, training, voting, result aggregation)"
        }
    })

if __name__ == '__main__':
    print("Starting DVRE Orchestration Server...")
    print("Two-Phase Active Learning Orchestration:")
    print("  Phase 1: Configuration & Setup (CWL workflow deployment)")
    print("  Phase 2: Runtime Orchestration (AL-engine communication)")
    print()
    print("API will be available at http://0.0.0.0:5003")
    print()
    print("Phase 1 - Submit CWL workflow:")
    print("curl -X POST -H 'Content-Type: application/json' \\")
    print("  -d '{\"project_id\":\"proj1\", \"cwl_workflow\":{...}, \"inputs\":{...}}' \\")
    print("  http://localhost:5003/streamflow/submit-project-workflow")
    print()
    print("Phase 2 - Start AL querying:")
    print("curl -X POST -H 'Content-Type: application/json' \\")
    print("  -d '{\"command_type\":\"start_querying\", \"project_id\":\"proj1\", \"workflow_id\":\"wf1\"}' \\")
    print("  http://localhost:5003/al-engine/command")
    print()
    
    # Try to import yaml, install if needed
    try:
        import yaml
    except ImportError:
        print("Installing PyYAML...")
        subprocess.check_call(["pip", "install", "PyYAML"])
        import yaml
    
    app.run(host='0.0.0.0', port=5003, debug=True) 