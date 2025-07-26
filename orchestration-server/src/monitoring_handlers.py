import json
from .base_handlers import BaseStreamflowHandler, require_authentication
from .storage import workflow_db, al_sessions_db, multi_user_sessions, get_database_info
from .multi_user_auth import RoleBasedDataFilter


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
            
            # Enhanced DAL workflow information
            is_dal_workflow = workflow.get('metadata', {}).get('is_dal_workflow', False)
            response["is_dal_workflow"] = is_dal_workflow
            
            if is_dal_workflow:
                response["dal_info"] = {
                    "template_type": workflow.get('metadata', {}).get('dal_workflow_type'),
                    "al_config": workflow.get('metadata', {}).get('al_config', {}),
                    "execution_complete": workflow.get('dal_execution_complete', False),
                    "coordination_paths_prepared": 'dal_coordination_paths' in workflow,
                    "execution_location": "client_side",
                    "client_files_expected": ["modal_run.py", "dal_engine.py"]
                }
            
            # Include AL session information if available
            project_id = workflow["project_id"]
            if project_id in al_sessions_db:
                response["active_sessions"] = len(al_sessions_db[project_id])
                response["sessions"] = list(al_sessions_db[project_id].keys())
                
                # Get session details for DAL workflows
                if is_dal_workflow:
                    dal_sessions = []
                    for session_id, session_data in al_sessions_db[project_id].items():
                        dal_sessions.append({
                            "session_id": session_id,
                            "status": session_data.get("status"),
                            "current_round": session_data.get("current_round"),
                            "strategy": session_data.get("strategy"),
                            "is_dal_session": session_data.get("is_dal_session", False)
                        })
                    response["dal_sessions"] = dal_sessions
            
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
                    "accuracy_metrics": session_data.get("accuracy_metrics", {}),
                    "is_dal_session": session_data.get("is_dal_session", False)
                }
                
                # Add DAL-specific information
                if session_data.get("is_dal_session", False):
                    session_info["dal_info"] = {
                        "strategy": session_data.get("strategy"),
                        "dal_config": session_data.get("dal_config", {}),
                        "enhanced_features": session_data.get("accuracy_metrics", {}).get("dal_enhanced", False)
                    }
                
                all_sessions.append(session_info)
        
        # Sort by creation time (newest first)
        all_sessions.sort(key=lambda x: x["created_at"], reverse=True)
        
        # Count DAL vs standard sessions
        dal_sessions = len([s for s in all_sessions if s.get("is_dal_session", False)])
        standard_sessions = len(all_sessions) - dal_sessions
        
        self.write(json.dumps({
            "sessions": all_sessions,
            "total_sessions": len(all_sessions),
            "dal_sessions": dal_sessions,
            "standard_sessions": standard_sessions,
            "total_projects": len(al_sessions_db)
        }))


class ALEngineSessionsHandler(BaseStreamflowHandler):
    def get(self, project_id):
        """List all active querying sessions for a project"""
        sessions = al_sessions_db.get(project_id, {})
        session_list = []
        
        for session_id, session_data in sessions.items():
            session_info = {
                "session_id": session_id,
                "status": session_data["status"],
                "current_round": session_data["current_round"],
                "total_rounds": session_data["total_rounds"],
                "created_at": session_data["created_at"],
                "accuracy_metrics": session_data.get("accuracy_metrics", {}),
                "is_dal_session": session_data.get("is_dal_session", False)
            }
            
            # Add DAL-specific information
            if session_data.get("is_dal_session", False):
                session_info["dal_info"] = {
                    "strategy": session_data.get("strategy"),
                    "dal_config": session_data.get("dal_config", {}),
                    "query_count": session_data.get("query_count"),
                    "enhanced_training": session_data.get("accuracy_metrics", {}).get("dal_enhanced", False)
                }
            
            session_list.append(session_info)
        
        # Sort by creation time (newest first)
        session_list.sort(key=lambda x: x["created_at"], reverse=True)
        
        # Count DAL vs standard sessions for this project
        dal_sessions = len([s for s in session_list if s.get("is_dal_session", False)])
        standard_sessions = len(session_list) - dal_sessions
        
        self.write(json.dumps({
            "project_id": project_id,
            "sessions": session_list,
            "total_sessions": len(session_list),
            "dal_sessions": dal_sessions,
            "standard_sessions": standard_sessions
        }))


class ALEngineSessionDetailHandler(BaseStreamflowHandler):
    def get(self, project_id, session_id):
        """Get detailed information about a specific querying session"""
        session = al_sessions_db.get(project_id, {}).get(session_id)
        if not session:
            self.set_status(404)
            self.write(json.dumps({"error": "Session not found"}))
            return
        
        # Enhanced session details with DAL information
        session_details = session.copy()
        
        # Add computed fields
        if session.get("is_dal_session", False):
            session_details["session_type"] = "DAL (Distributed Active Learning)"
            session_details["template_features"] = {
                "modAL_integration": True,
                "scikit_learn_backend": True,
                "enhanced_accuracy": session.get("accuracy_metrics", {}).get("dal_enhanced", False),
                "template_version": "v1.2"
            }
        else:
            session_details["session_type"] = "Standard Active Learning"
        
        # Add progress information
        if "queried_samples" in session:
            session_details["sample_progress"] = {
                "queried_count": len(session["queried_samples"]),
                "labeled_count": session.get("total_labeled_samples", 0),
                "completion_percentage": (session.get("total_labeled_samples", 0) / len(session["queried_samples"]) * 100) if session["queried_samples"] else 0
            }
        
        self.write(json.dumps(session_details))


class StreamflowListWorkflowsHandler(BaseStreamflowHandler):
    def get(self):
        """List all workflows with project information and DAL filtering"""
        project_filter = self.get_argument('project_id', None)
        dal_filter = self.get_argument('dal_only', None)  # 'true' to show only DAL workflows
        
        workflows = []
        for wid, workflow in workflow_db.items():
            # Filter by project if requested
            if project_filter and workflow.get('project_id') != project_filter:
                continue
            
            # Filter by DAL type if requested
            is_dal_workflow = workflow.get('metadata', {}).get('is_dal_workflow', False)
            if dal_filter == 'true' and not is_dal_workflow:
                continue
                
            workflow_info = {
                "workflow_id": wid,
                "status": workflow["status"],
                "created_at": workflow["created_at"],
                "phase": workflow.get("phase", "unknown"),
                "is_dal_workflow": is_dal_workflow
            }
            
            # Include project info if available
            if "project_id" in workflow:
                workflow_info["project_id"] = workflow["project_id"]
                workflow_info["project_title"] = workflow.get("metadata", {}).get("project_title")
                
                # Add DAL-specific information
                if is_dal_workflow:
                    workflow_info["dal_info"] = {
                        "template_type": workflow.get('metadata', {}).get('dal_workflow_type'),
                        "al_strategy": workflow.get('metadata', {}).get('al_config', {}).get('query_strategy'),
                        "execution_complete": workflow.get('dal_execution_complete', False)
                    }
                
                # Include session count
                project_id = workflow["project_id"]
                if project_id in al_sessions_db:
                    workflow_info["active_sessions"] = len(al_sessions_db[project_id])
                    dal_sessions_count = len([s for s in al_sessions_db[project_id].values() if s.get("is_dal_session", False)])
                    workflow_info["dal_sessions_count"] = dal_sessions_count
                
            workflows.append(workflow_info)
        
        # Sort by creation time (newest first)
        workflows.sort(key=lambda x: x["created_at"], reverse=True)
        
        # Count DAL vs standard workflows
        dal_workflows = len([w for w in workflows if w.get("is_dal_workflow", False)])
        standard_workflows = len(workflows) - dal_workflows
        
        response = {
            "workflows": workflows,
            "total_workflows": len(workflows),
            "dal_workflows": dal_workflows,
            "standard_workflows": standard_workflows
        }
        
        if dal_filter == 'true':
            response["filter_applied"] = "DAL workflows only"
        
        self.write(json.dumps(response))


class StreamflowProjectWorkflowsHandler(BaseStreamflowHandler):
    def get(self, project_id):
        """Get all workflows for a specific project with DAL information"""
        project_workflows = []
        
        for wid, workflow in workflow_db.items():
            if workflow.get('project_id') == project_id:
                is_dal_workflow = workflow.get('metadata', {}).get('is_dal_workflow', False)
                
                workflow_info = {
                    "workflow_id": wid,
                    "status": workflow["status"],
                    "created_at": workflow["created_at"],
                    "metadata": workflow.get("metadata", {}),
                    "phase": workflow.get("phase", "unknown"),
                    "is_dal_workflow": is_dal_workflow
                }
                
                # Add DAL-specific information
                if is_dal_workflow:
                    workflow_info["dal_info"] = {
                        "template_type": workflow.get('metadata', {}).get('dal_workflow_type'),
                        "al_config": workflow.get('metadata', {}).get('al_config', {}),
                        "execution_complete": workflow.get('dal_execution_complete', False),
                        "file_paths_prepared": 'dal_file_paths' in workflow
                    }
                
                # Include session information
                if project_id in al_sessions_db:
                    workflow_info["active_sessions"] = len(al_sessions_db[project_id])
                    workflow_info["sessions"] = list(al_sessions_db[project_id].keys())
                    
                    # Count DAL vs standard sessions
                    dal_sessions = len([s for s in al_sessions_db[project_id].values() if s.get("is_dal_session", False)])
                    workflow_info["dal_sessions_count"] = dal_sessions
                
                project_workflows.append(workflow_info)
        
        # Sort by creation time (newest first)
        project_workflows.sort(key=lambda x: x["created_at"], reverse=True)
        
        # Count DAL vs standard workflows for this project
        dal_workflows = len([w for w in project_workflows if w.get("is_dal_workflow", False)])
        standard_workflows = len(project_workflows) - dal_workflows
        
        self.write(json.dumps({
            "project_id": project_id,
            "workflows": project_workflows,
            "total_count": len(project_workflows),
            "dal_workflows": dal_workflows,
            "standard_workflows": standard_workflows,
            "active_sessions": len(al_sessions_db.get(project_id, {}))
        }))


class DatabaseStatsHandler(BaseStreamflowHandler):
    def get(self):
        """Get comprehensive database and system statistics"""
        try:
            database_info = get_database_info()
            
            # Enhanced statistics
            workflow_stats = {
                "total": len(workflow_db),
                "by_status": {},
                "by_phase": {},
                "dal_workflows": 0,
                "standard_workflows": 0
            }
            
            # Count workflows by status and type
            for workflow in workflow_db.values():
                status = workflow.get("status", "unknown")
                phase = workflow.get("phase", "unknown")
                is_dal = workflow.get('metadata', {}).get('is_dal_workflow', False)
                
                workflow_stats["by_status"][status] = workflow_stats["by_status"].get(status, 0) + 1
                workflow_stats["by_phase"][phase] = workflow_stats["by_phase"].get(phase, 0) + 1
                
                if is_dal:
                    workflow_stats["dal_workflows"] += 1
                else:
                    workflow_stats["standard_workflows"] += 1
            
            database_info["enhanced_workflow_stats"] = workflow_stats
            
            self.write(json.dumps(database_info))
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))


class StreamflowHomeHandler(BaseStreamflowHandler):
    def get(self):
        """Home page with enhanced API documentation including DAL features"""
        self.write(json.dumps({
            "message": "DVRE Orchestration Server - Two-Phase Active Learning with Multi-User Support & DAL Templates",
            "description": "Phase 1: Configuration & Setup | Phase 2: Runtime Orchestration | Multi-User: Role-based Access Control | DAL: Distributed Active Learning Templates",
            "endpoints": {
                "Phase 1 - Configuration": {
                    "POST /streamflow/submit-project-workflow": "Submit and finalize CWL workflow configuration (Coordinator only)",
                    "POST /streamflow/submit-project-workflow (DAL)": "Submit using DAL templates with use_dal_template=true",
                    "GET /streamflow/status/<id>": "Get workflow status (enhanced with DAL info)",
                    "GET /streamflow/workflows": "List all workflows (supports ?dal_only=true filter)",
                    "GET /dal/templates": "Get DAL workflow template information"
                },
                "Phase 2 - Runtime Orchestration": {
                    "POST /al-engine/command": "Send commands to AL-engine (enhanced DAL support)",
                    "GET /al-engine/sessions/<project_id>": "List active querying sessions (DAL + standard)",
                    "GET /al-engine/sessions": "List all sessions across projects",
                    "GET /al-engine/sessions/<project_id>/<session_id>": "Get session details (enhanced DAL info)"
                },
                "Multi-User Management": {
                    "POST /users/authenticate": "Validate user request from DVRE",
                    "GET /users/project-info/<project_id>": "Get project info for authenticated user",
                    "GET /users/my-projects": "List user's accessible projects",
                    "POST /al-engine/assign-samples": "Assign samples to contributors (Coordinator only)",
                    "POST /al-engine/submit-labels": "Submit labels for assigned samples (Contributor only)"
                },
                "Monitoring & Stats": {
                    "GET /": "This help page",
                    "GET /streamflow/projects/<project_id>/workflows": "Get project workflows and sessions",
                    "GET /database/stats": "Get comprehensive database statistics"
                }
            },
            "user_roles": {
                "coordinator": "Project owner - full access to all operations, can use DAL templates",
                "contributor": "Project member - can submit labels and view assigned work"
            },
            "workflow_types": {
                "Standard": "Traditional CWL workflows with basic AL support",
                "DAL": "Distributed Active Learning workflows using modAL + scikit-learn templates"
            },
            "dal_features": {
                "supported_templates": ["train_query", "modal_run"],
                "supported_strategies": ["uncertainty_sampling"],
                "supported_models": ["RandomForestClassifier"],
                "template_auto_generation": True,
                "enhanced_accuracy_tracking": True,
                "coordination_mode": "Server orchestrates, client executes",
                "execution_location": "Client-side (modal_run.py + dal_engine.py)",
                "file_preparation": "Server generates coordination configs and instructions for client AL engines"
            },
            "workflow_phases": {
                "Phase 1": "Configuration & Setup (CWL deployment, smart contracts, IPFS uploads)",
                "Phase 2": "Runtime Orchestration (AL querying, training, voting, result aggregation)"
            }
        })) 