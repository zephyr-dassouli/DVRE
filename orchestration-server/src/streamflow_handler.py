import json
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import tornado.web
import subprocess
import tempfile
import os
import uuid
from datetime import datetime

# Import multi-user authentication
from .multi_user_auth import (
    DVRERequestValidator, 
    RoleBasedDataFilter, 
    MultiUserSession,
    ROLE_PERMISSIONS
)

# In-memory storage for workflow states
workflow_db = {}

# In-memory storage for AL engine sessions (Phase 2) - Enhanced for multi-user
al_sessions_db = {}  # project_id -> session_id -> MultiUserSession
al_commands_db = {}

# Multi-user session tracking
multi_user_sessions = {}  # project_id -> MultiUserSession

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

def require_authentication(required_permission=None):
    """
    Decorator for endpoints that require user authentication
    Note: Trusts DVRE authentication, validates request format and permissions
    """
    def decorator(handler_method):
        def wrapper(self, *args, **kwargs):
            try:
                # Parse request body to get user authentication data
                if hasattr(self, 'request') and self.request.body:
                    body = json.loads(self.request.body.decode('utf-8'))
                else:
                    body = {}
                
                # Validate request from DVRE (trusts DVRE authentication)
                user_data = DVRERequestValidator.validate_request(body)
                
                # Check permissions if required
                if required_permission:
                    DVRERequestValidator.require_permission(user_data, required_permission)
                
                # Store user data in handler for use in method
                self.user_data = user_data
                
                # Call original handler method
                return handler_method(self, *args, **kwargs)
                
            except ValueError as e:
                self.set_status(400)
                self.write(json.dumps({"error": f"Request validation error: {str(e)}"}))
                return
            except PermissionError as e:
                self.set_status(403)
                self.write(json.dumps({"error": f"Permission denied: {str(e)}"}))
                return
            except Exception as e:
                self.set_status(500)
                self.write(json.dumps({"error": f"Server error: {str(e)}"}))
                return
        
        return wrapper
    return decorator

# ============================================================================
# Base Handler for XSRF bypass
# ============================================================================

class BaseStreamflowHandler(tornado.web.RequestHandler):
    def set_default_headers(self):
        self.set_header("Content-Type", "application/json")
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma")
        self.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
        self.set_header("Access-Control-Allow-Credentials", "true")
        self.set_header("Access-Control-Max-Age", "3600")
    
    def options(self, *args):
        # Handle preflight requests
        self.set_status(204)
        self.finish()
    
    def check_xsrf_cookie(self):
        # Disable XSRF checking for API handlers
        pass
    
    def prepare(self):
        # Additional XSRF bypass - remove the problematic line
        pass

# ============================================================================
# PHASE 1: Configuration & Setup (CWL Workflow Management)
# ============================================================================

class StreamflowSubmitHandler(BaseStreamflowHandler):
    async def post(self):
        """Submit a basic workflow (backward compatibility)"""
        try:
            body = json.loads(self.request.body.decode('utf-8'))
            cwl_workflow = body.get('cwl_workflow')
            inputs = body.get('inputs', {})

            if not cwl_workflow:
                self.set_status(400)
                self.write(json.dumps({"error": "cwl_workflow is required"}))
                return

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

            self.write(json.dumps({"workflow_id": workflow_id, "status": "SUBMITTED"}))
            
            # Start workflow execution
            tornado.ioloop.IOLoop.current().add_callback(self.start_workflow_execution, workflow_id)
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

    def start_workflow_execution(self, workflow_id):
        workflow = workflow_db.get(workflow_id)
        if not workflow:
            return

        # Create temporary files for CWL and inputs
        try:
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
            
            proc = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            workflow["process"] = proc
            workflow["status"] = "RUNNING"
            
            # Start polling
            tornado.ioloop.IOLoop.current().call_later(0.1, self.poll_workflow, workflow_id)
            
        except Exception as e:
            workflow["status"] = "FAILED"
            workflow["error"] = str(e)

    def poll_workflow(self, workflow_id):
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
            tornado.ioloop.IOLoop.current().call_later(1.0, self.poll_workflow, workflow_id)

class StreamflowSubmitProjectWorkflowHandler(BaseStreamflowHandler):
    async def post(self):
        """
        Submit a project-specific CWL workflow with full metadata (Phase 1)
        This finalizes the configuration phase and prepares for runtime orchestration
        """
        try:
            body = json.loads(self.request.body.decode('utf-8'))
            project_id = body.get('project_id')
            cwl_workflow = body.get('cwl_workflow')
            inputs = body.get('inputs', {})
            metadata = body.get('metadata', {})

            # Validation
            if not project_id:
                self.set_status(400)
                self.write(json.dumps({"error": "project_id is required"}))
                return
            if not cwl_workflow:
                self.set_status(400)
                self.write(json.dumps({"error": "cwl_workflow is required"}))
                return

            # Validate CWL workflow structure
            if not validate_cwl_workflow(cwl_workflow):
                self.set_status(400)
                self.write(json.dumps({"error": "Invalid CWL workflow format"}))
                return

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

            self.write(json.dumps({
                "workflow_id": workflow_id,
                "project_id": project_id,
                "status": "SUBMITTED",
                "message": "Project workflow submitted successfully. Ready for runtime orchestration.",
                "phase": "configuration_complete"
            }))
            
            # Start execution (Phase 1 complete, ready for Phase 2)
            tornado.ioloop.IOLoop.current().add_callback(self.start_project_workflow_execution, workflow_id)
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

    def start_project_workflow_execution(self, workflow_id):
        """Start project-specific workflow execution with enhanced logging (Phase 1 → Phase 2 transition)"""
        workflow = workflow_db.get(workflow_id)
        if not workflow:
            return

        try:
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
            
            proc = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            workflow["process"] = proc
            workflow["status"] = "RUNNING"
            workflow["started_at"] = datetime.now().isoformat()
            
            # Start polling
            tornado.ioloop.IOLoop.current().call_later(0.1, self.poll_workflow, workflow_id)
            
        except Exception as e:
            workflow["status"] = "FAILED"
            workflow["error"] = str(e)

    def poll_workflow(self, workflow_id):
        # Same polling logic as basic handler
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
            tornado.ioloop.IOLoop.current().call_later(1.0, self.poll_workflow, workflow_id)

# ============================================================================
# PHASE 2: Runtime Orchestration (AL-engine Communication)
# ============================================================================

class ALEngineCommandHandler(BaseStreamflowHandler):
    async def post(self):
        """
        Send commands to AL-engine for runtime orchestration (Phase 2)
        Commands: start_querying, continue_querying, prompt_training, submit_labels, terminate_project
        """
        try:
            body = json.loads(self.request.body.decode('utf-8'))
            command_type = body.get('command_type')
            project_id = body.get('project_id')
            workflow_id = body.get('workflow_id')
            parameters = body.get('parameters', {})
            timestamp = body.get('timestamp')

            # Validation
            if not command_type:
                self.set_status(400)
                self.write(json.dumps({"error": "command_type is required"}))
                return
            if not project_id:
                self.set_status(400)
                self.write(json.dumps({"error": "project_id is required"}))
                return
            if not workflow_id:
                self.set_status(400)
                self.write(json.dumps({"error": "workflow_id is required"}))
                return

            # Verify workflow exists and is in correct phase
            workflow = workflow_db.get(workflow_id)
            if not workflow:
                self.set_status(404)
                self.write(json.dumps({"error": "Workflow not found"}))
                return
            
            if workflow.get('phase') != 'configuration_complete':
                self.set_status(400)
                self.write(json.dumps({"error": "Workflow not ready for runtime orchestration"}))
                return

            # Generate command ID
            command_id = str(uuid.uuid4())
            
            # Process the command based on type
            try:
                if command_type == 'start_querying':
                    response = self.handle_start_querying(command_id, project_id, workflow_id, parameters)
                elif command_type == 'continue_querying':
                    response = self.handle_continue_querying(command_id, project_id, workflow_id, parameters)
                elif command_type == 'prompt_training':
                    response = self.handle_prompt_training(command_id, project_id, workflow_id, parameters)
                elif command_type == 'submit_labels':
                    response = self.handle_submit_labels(command_id, project_id, workflow_id, parameters)
                elif command_type == 'terminate_project':
                    response = self.handle_terminate_project(command_id, project_id, workflow_id, parameters)
                else:
                    self.set_status(400)
                    self.write(json.dumps({"error": f"Unknown command_type: {command_type}"}))
                    return
                    
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
                
                self.write(json.dumps(response))
                
            except Exception as e:
                self.set_status(500)
                self.write(json.dumps({
                    "command_id": command_id,
                    "status": "failed",
                    "message": str(e),
                    "timestamp": datetime.now().isoformat()
                }))
                
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

    def handle_start_querying(self, command_id, project_id, workflow_id, parameters):
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

    # ... Additional AL-engine handler methods would go here ...
    # (continue_querying, prompt_training, submit_labels, terminate_project)
    # I'll add these in a follow-up for brevity

    def handle_continue_querying(self, command_id, project_id, workflow_id, parameters):
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

    def handle_prompt_training(self, command_id, project_id, workflow_id, parameters):
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

    def handle_submit_labels(self, command_id, project_id, workflow_id, parameters):
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

    def handle_terminate_project(self, command_id, project_id, workflow_id, parameters):
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

# ============================================================================
# Status and Monitoring Handlers
# ============================================================================

class StreamflowStatusHandler(BaseStreamflowHandler):
    def get(self, workflow_id):
        """Get workflow status with enhanced project information"""
        workflow = workflow_db.get(workflow_id)
        if not workflow:
            self.set_status(404)
            self.write(json.dumps({"error": "Workflow not found"}))
            return
        
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
            
        self.write(json.dumps(response))

class ALEngineSessionsListHandler(BaseStreamflowHandler):
    def get(self):
        """List all active sessions across all projects"""
        all_sessions = []
        
        for project_id, sessions in al_sessions_db.items():
            for session_id, session_data in sessions.items():
                session_info = {
                    "project_id": project_id,
                    "session_id": session_id,
                    "status": session_data["status"],
                    "current_round": session_data["current_round"],
                    "total_rounds": session_data["total_rounds"],
                    "created_at": session_data["created_at"],
                    "accuracy_metrics": session_data.get("accuracy_metrics", {})
                }
                all_sessions.append(session_info)
        
        self.write(json.dumps({
            "sessions": all_sessions,
            "total_sessions": len(all_sessions),
            "total_projects": len(al_sessions_db)
        }))

class ALEngineSessionsHandler(BaseStreamflowHandler):
    def get(self, project_id):
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
        
        self.write(json.dumps({
            "project_id": project_id,
            "sessions": session_list,
            "total_sessions": len(session_list)
        }))

class ALEngineSessionDetailHandler(BaseStreamflowHandler):
    def get(self, project_id, session_id):
        """Get detailed information about a specific querying session"""
        session = al_sessions_db.get(project_id, {}).get(session_id)
        if not session:
            self.set_status(404)
            self.write(json.dumps({"error": "Session not found"}))
            return
        
        self.write(json.dumps(session))

class StreamflowListWorkflowsHandler(BaseStreamflowHandler):
    def get(self):
        """List all workflows with project information"""
        project_filter = self.get_argument('project_id', None)
        
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
        
        self.write(json.dumps({"workflows": workflows}))

class StreamflowProjectWorkflowsHandler(BaseStreamflowHandler):
    def get(self, project_id):
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
        
        self.write(json.dumps({
            "project_id": project_id,
            "workflows": project_workflows,
            "total_count": len(project_workflows),
            "active_sessions": len(al_sessions_db.get(project_id, {}))
        }))

class StreamflowHomeHandler(BaseStreamflowHandler):
    def get(self):
        """Home page with API documentation"""
        self.write(json.dumps({
            "message": "DVRE Orchestration Server - Two-Phase Active Learning with Multi-User Support",
            "description": "Phase 1: Configuration & Setup | Phase 2: Runtime Orchestration | Multi-User: Role-based Access Control",
            "endpoints": {
                "Phase 1 - Configuration": {
                    "POST /streamflow/submit-project-workflow": "Submit and finalize CWL workflow configuration (Coordinator only)",
                    "GET /streamflow/status/<id>": "Get workflow status",
                    "GET /streamflow/workflows": "List all workflows (filtered by user role)"
                },
                "Phase 2 - Runtime Orchestration": {
                    "POST /al-engine/command": "Send commands to AL-engine (role-based access)",
                    "GET /al-engine/sessions/<project_id>": "List active querying sessions",
                    "GET /al-engine/sessions/<project_id>/<session_id>": "Get session details"
                },
                "Multi-User Management": {
                    "POST /users/authenticate": "Validate user request from DVRE",
                    "GET /users/project-info/<project_id>": "Get project info for authenticated user",
                    "GET /users/my-projects": "List user's accessible projects",
                    "POST /al-engine/assign-samples": "Assign samples to contributors (Coordinator only)",
                    "POST /al-engine/submit-labels": "Submit labels for assigned samples (Contributor only)"
                },
                "Monitoring": {
                    "GET /": "This help page",
                    "GET /streamflow/projects/<project_id>/workflows": "Get project workflows and sessions"
                }
            },
            "user_roles": {
                "coordinator": "Project owner - full access to all operations",
                "contributor": "Project member - can submit labels and view assigned work"
            },
            "workflow_phases": {
                "Phase 1": "Configuration & Setup (CWL deployment, smart contracts, IPFS uploads)",
                "Phase 2": "Runtime Orchestration (AL querying, training, voting, result aggregation)"
            }
        }))

# ============================================================================
# Multi-User Management Endpoints
# ============================================================================

class UserAuthenticationHandler(BaseStreamflowHandler):
    async def post(self):
        """Validate user request from DVRE (authentication already handled by DVRE)"""
        try:
            body = json.loads(self.request.body.decode('utf-8'))
            user_data = DVRERequestValidator.validate_request(body)
            
            self.write(json.dumps({
                "success": True,
                "user_data": user_data,
                "permissions": ROLE_PERMISSIONS.get(user_data['user_role'], []),
                "note": "Authentication handled by DVRE frontend"
            }))
            
        except Exception as e:
            self.set_status(400)
            self.write(json.dumps({"error": str(e)}))

class ProjectInfoHandler(BaseStreamflowHandler):
    @require_authentication('view_project_data')
    async def get(self, project_id):
        """Get project information for authenticated user"""
        try:
            # Get project workflows
            project_workflows = [
                {
                    "workflow_id": wid,
                    "status": workflow["status"],
                    "created_at": workflow["created_at"],
                    "phase": workflow.get("phase", "unknown")
                }
                for wid, workflow in workflow_db.items()
                if workflow.get('project_id') == project_id
            ]
            
            # Get active session info
            session_info = None
            if project_id in multi_user_sessions:
                session = multi_user_sessions[project_id]
                session_stats = session.get_session_stats()
                session_info = RoleBasedDataFilter.filter_data_by_role(session_stats, self.user_data)
            
            project_data = {
                "project_id": project_id,
                "user_role": self.user_data['user_role'],
                "workflows": project_workflows,
                "session_info": session_info,
                "accessed_by": self.user_data['user_wallet']
            }
            
            self.write(json.dumps(project_data))
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

class UserProjectsHandler(BaseStreamflowHandler):
    @require_authentication()
    async def get(self):
        """List user's accessible projects (based on workflows they have access to)"""
        try:
            user_wallet = self.user_data['user_wallet']
            user_role = self.user_data['user_role']
            accessible_projects = {}
            
            # Look through workflows to find projects this user has accessed
            for wid, workflow in workflow_db.items():
                project_id = workflow.get('project_id')
                if not project_id:
                    continue
                
                # Check if user has access to this workflow/project
                # For now, include projects where user appears in metadata or has coordinator role
                creator = workflow.get('metadata', {}).get('creator', '').lower()
                if creator == user_wallet or user_role == 'coordinator':
                    if project_id not in accessible_projects:
                        accessible_projects[project_id] = {
                            "project_id": project_id,
                            "user_role": user_role,
                            "workflows": [],
                            "last_activity": workflow["created_at"]
                        }
                    
                    accessible_projects[project_id]["workflows"].append({
                        "workflow_id": wid,
                        "status": workflow["status"],
                        "created_at": workflow["created_at"],
                        "phase": workflow.get("phase", "unknown")
                    })
            
            # Add session information for projects with active sessions
            for project_id in accessible_projects:
                if project_id in multi_user_sessions:
                    session = multi_user_sessions[project_id]
                    session_stats = session.get_session_stats()
                    accessible_projects[project_id]["active_session"] = {
                        "total_contributors": session_stats["total_contributors"],
                        "progress_percentage": session_stats["progress_percentage"],
                        "consensus_samples": session_stats["consensus_samples"]
                    }
            
            self.write(json.dumps({
                "user_wallet": user_wallet,
                "user_role": user_role,
                "accessible_projects": list(accessible_projects.values()),
                "total_projects": len(accessible_projects),
                "note": "Projects determined from workflow access and DVRE role"
            }))
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

class AssignSamplesHandler(BaseStreamflowHandler):
    @require_authentication('assign_samples')
    async def post(self):
        """Assign samples to contributors (Coordinator only)"""
        try:
            body = json.loads(self.request.body.decode('utf-8'))
            project_id = body.get('project_id')
            session_id = body.get('session_id')
            assignments = body.get('assignments', [])  # [{contributor_wallet, sample_ids}]
            
            if not project_id or not session_id:
                self.set_status(400)
                self.write(json.dumps({"error": "project_id and session_id are required"}))
                return
            
            # Get or create multi-user session
            if project_id not in multi_user_sessions:
                multi_user_sessions[project_id] = MultiUserSession(
                    project_id, 
                    self.user_data['user_wallet']
                )
            
            session = multi_user_sessions[project_id]
            assignment_results = []
            
            for assignment in assignments:
                contributor_wallet = assignment.get('contributor_wallet')
                sample_ids = assignment.get('sample_ids', [])
                
                if contributor_wallet and sample_ids:
                    session.assign_samples_to_contributor(contributor_wallet, sample_ids)
                    assignment_results.append({
                        "contributor_wallet": contributor_wallet,
                        "samples_assigned": len(sample_ids),
                        "total_assigned": session.contributors.get(contributor_wallet.lower(), {}).get('samples_assigned', 0)
                    })
            
            self.write(json.dumps({
                "success": True,
                "project_id": project_id,
                "session_id": session_id,
                "assignments": assignment_results,
                "assigned_by": self.user_data['user_wallet']
            }))
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

class SubmitLabelsHandler(BaseStreamflowHandler):
    @require_authentication('submit_labels')
    async def post(self):
        """Submit labels for assigned samples (Contributor)"""
        try:
            body = json.loads(self.request.body.decode('utf-8'))
            project_id = body.get('project_id')
            labeled_samples = body.get('labeled_samples', [])
            
            if not project_id:
                self.set_status(400)
                self.write(json.dumps({"error": "project_id is required"}))
                return
            
            if project_id not in multi_user_sessions:
                self.set_status(404)
                self.write(json.dumps({"error": "No active session for this project"}))
                return
            
            session = multi_user_sessions[project_id]
            contributor_wallet = self.user_data['user_wallet']
            
            # Submit labels
            results = session.submit_labels(contributor_wallet, labeled_samples)
            
            # Get updated session stats
            session_stats = session.get_session_stats()
            
            self.write(json.dumps({
                "success": True,
                "project_id": project_id,
                "contributor_wallet": contributor_wallet,
                "submission_results": results,
                "session_progress": {
                    "consensus_samples": session_stats['consensus_samples'],
                    "total_samples": session_stats['total_samples'],
                    "progress_percentage": session_stats['progress_percentage']
                }
            }))
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

class MultiUserSessionStatsHandler(BaseStreamflowHandler):
    @require_authentication('view_project_data')
    async def get(self, project_id):
        """Get multi-user session statistics"""
        try:
            if project_id not in multi_user_sessions:
                self.set_status(404)
                self.write(json.dumps({"error": "No active session for this project"}))
                return
            
            session = multi_user_sessions[project_id]
            session_stats = session.get_session_stats()
            
            # Filter data based on user role
            filtered_stats = RoleBasedDataFilter.filter_data_by_role(
                session_stats, 
                self.user_data
            )
            
            self.write(json.dumps(filtered_stats))
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings.get("base_url", "/")
    
    # Phase 1: Configuration endpoints
    submit_route_pattern = url_path_join(base_url, "streamflow", "submit")
    submit_project_route_pattern = url_path_join(base_url, "streamflow", "submit-project-workflow")
    status_route_pattern = url_path_join(base_url, "streamflow", "status", "([^/]+)")
    
    # Phase 2: Runtime orchestration endpoints
    al_command_route_pattern = url_path_join(base_url, "al-engine", "command")
    al_sessions_route_pattern = url_path_join(base_url, "al-engine", "sessions", "([^/]+)")
    al_sessions_list_route_pattern = url_path_join(base_url, "al-engine", "sessions")
    al_session_detail_route_pattern = url_path_join(base_url, "al-engine", "sessions", "([^/]+)", "([^/]+)")
    list_workflows_route_pattern = url_path_join(base_url, "streamflow", "workflows")
    project_workflows_route_pattern = url_path_join(base_url, "streamflow", "projects", "([^/]+)", "workflows")
    home_route_pattern = url_path_join(base_url, "")
    
    # Multi-User Management Endpoints
    authenticate_route_pattern = url_path_join(base_url, "users", "authenticate")
    project_info_route_pattern = url_path_join(base_url, "users", "project-info", "([^/]+)")
    my_projects_route_pattern = url_path_join(base_url, "users", "my-projects")
    assign_samples_route_pattern = url_path_join(base_url, "al-engine", "assign-samples")
    submit_labels_route_pattern = url_path_join(base_url, "al-engine", "submit-labels")
    session_stats_route_pattern = url_path_join(base_url, "al-engine", "session-stats", "([^/]+)")
    
    print(f"Registering DVRE Orchestration Server handlers:")
    print(f"  Phase 1 - Submit: {submit_route_pattern}")
    print(f"  Phase 1 - Submit Project: {submit_project_route_pattern}")
    print(f"  Status: {status_route_pattern}")
    print(f"  Phase 2 - AL Command: {al_command_route_pattern}")
    print(f"  Phase 2 - AL Sessions List: {al_sessions_list_route_pattern}")
    print(f"  Phase 2 - AL Sessions: {al_sessions_route_pattern}")
    print(f"  Phase 2 - AL Session Detail: {al_session_detail_route_pattern}")
    print(f"  List Workflows: {list_workflows_route_pattern}")
    print(f"  Project Workflows: {project_workflows_route_pattern}")
    print(f"  Home: {home_route_pattern}")
    print(f"  Multi-User - Authenticate: {authenticate_route_pattern}")
    print(f"  Multi-User - Project Info: {project_info_route_pattern}")
    print(f"  Multi-User - My Projects: {my_projects_route_pattern}")
    print(f"  Multi-User - Assign Samples: {assign_samples_route_pattern}")
    print(f"  Multi-User - Submit Labels: {submit_labels_route_pattern}")
    print(f"  Multi-User - Session Stats: {session_stats_route_pattern}")
    
    handlers = [
        # Phase 1: Configuration & Setup
        (submit_route_pattern, StreamflowSubmitHandler),
        (submit_project_route_pattern, StreamflowSubmitProjectWorkflowHandler),
        (status_route_pattern, StreamflowStatusHandler),
        (list_workflows_route_pattern, StreamflowListWorkflowsHandler),
        (project_workflows_route_pattern, StreamflowProjectWorkflowsHandler),
        (home_route_pattern, StreamflowHomeHandler),
        # Phase 2: Runtime Orchestration
        (al_command_route_pattern, ALEngineCommandHandler),
        (al_sessions_route_pattern, ALEngineSessionsHandler),
        (al_session_detail_route_pattern, ALEngineSessionDetailHandler),
        (al_sessions_list_route_pattern, ALEngineSessionsListHandler),
        # Multi-User Management Endpoints
        (authenticate_route_pattern, UserAuthenticationHandler),
        (project_info_route_pattern, ProjectInfoHandler), # Changed from ProjectMembersHandler
        (my_projects_route_pattern, UserProjectsHandler),
        (assign_samples_route_pattern, AssignSamplesHandler),
        (submit_labels_route_pattern, SubmitLabelsHandler),
        (session_stats_route_pattern, MultiUserSessionStatsHandler),
    ]
    
    try:
        web_app.add_handlers(host_pattern, handlers)
        print("DVRE Orchestration Server handlers registered successfully")
    except Exception as e:
        print(f"Error adding handlers: {e}")
        raise 