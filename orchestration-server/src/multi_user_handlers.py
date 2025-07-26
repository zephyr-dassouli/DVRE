import json
from .base_handlers import BaseStreamflowHandler, require_authentication
from .storage import workflow_db, multi_user_sessions
from .multi_user_auth import (
    DVRERequestValidator, 
    RoleBasedDataFilter, 
    MultiUserSession,
    ROLE_PERMISSIONS
)


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
                    "phase": workflow.get("phase", "unknown"),
                    "is_dal_workflow": workflow.get('metadata', {}).get('is_dal_workflow', False)
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
                        "phase": workflow.get("phase", "unknown"),
                        "is_dal_workflow": workflow.get('metadata', {}).get('is_dal_workflow', False)
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
        """Redirect sample assignment to smart contract (orchestrator doesn't manage assignments)"""
        try:
            body = json.loads(self.request.body.decode('utf-8'))
            project_id = body.get('project_id')
            session_id = body.get('session_id')
            assignments = body.get('assignments', [])  # [{contributor_wallet, sample_ids}]
            
            if not project_id or not session_id:
                self.set_status(400)
                self.write(json.dumps({"error": "project_id and session_id are required"}))
                return
            
            # For DAL projects, redirect to smart contract
            self.write(json.dumps({
                "status": "redirected_to_smart_contract",
                "message": "Sample assignment should be handled by smart contract, not orchestrator",
                "redirect_to": "smart_contract",
                "project_id": project_id,
                "session_id": session_id,
                "assignment_count": len(assignments),
                "smart_contract_handles": [
                    "User management", 
                    "Sample assignment",
                    "Voting coordination",
                    "Consensus determination"
                ],
                "orchestrator_role": "workflow_coordination_only",
                "assigned_by": self.user_data['user_wallet']
            }))
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))


class SubmitLabelsHandler(BaseStreamflowHandler):
    @require_authentication('submit_labels')
    async def post(self):
        """Redirect label submission to smart contract (orchestrator doesn't handle voting)"""
        try:
            body = json.loads(self.request.body.decode('utf-8'))
            project_id = body.get('project_id')
            labeled_samples = body.get('labeled_samples', [])
            
            if not project_id:
                self.set_status(400)
                self.write(json.dumps({"error": "project_id is required"}))
                return
            
            # For DAL projects, all labeling goes through smart contract
            self.write(json.dumps({
                "status": "redirected_to_smart_contract",
                "message": "Label submission should go to smart contract, not orchestrator",
                "redirect_to": "smart_contract",
                "project_id": project_id,
                "contributor_wallet": self.user_data['user_wallet'],
                "sample_count": len(labeled_samples),
                "smart_contract_workflow": [
                    "1. Contributors submit votes to smart contract",
                    "2. Smart contract collects and aggregates votes", 
                    "3. Smart contract determines consensus labels",
                    "4. Smart contract sends results to client AL-engine",
                    "5. Client AL-engine continues with training"
                ],
                "orchestrator_role": "coordination_only"
            }))
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))


class MultiUserSessionStatsHandler(BaseStreamflowHandler):
    @require_authentication('view_project_data')
    async def get(self, project_id):
        """Get session metadata (actual voting stats are in smart contract)"""
        try:
            # Return minimal orchestrator-side metadata only
            self.write(json.dumps({
                "project_id": project_id,
                "orchestrator_metadata": {
                    "session_coordination": "active",
                    "workflow_status": "coordinating",
                    "user_role": self.user_data['user_role'],
                    "accessed_by": self.user_data['user_wallet']
                },
                "voting_and_user_stats": {
                    "location": "smart_contract",
                    "note": "All voting, consensus, and user management data is in the smart contract",
                    "access_via": "smart_contract_queries"
                },
                "orchestrator_responsibilities": [
                    "Workflow coordination", 
                    "Session metadata",
                    "Client instruction generation"
                ],
                "smart_contract_responsibilities": [
                    "User management",
                    "Voting collection", 
                    "Consensus determination",
                    "Label result distribution"
                ]
            }))
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)})) 