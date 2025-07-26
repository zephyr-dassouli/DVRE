import json
import os
import uuid
import tempfile
import subprocess
import asyncio
import tornado
from datetime import datetime
from .base_handlers import BaseStreamflowHandler, require_authentication
from .dal_templates import DALWorkflowTemplate
from .storage import workflow_db
from .streamflow_config import streamflow_orchestrator


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


class StreamflowSubmitHandler(BaseStreamflowHandler):
    async def post(self):
        """Submit a basic workflow: StreamFlow orchestrates, client executes with cwltool"""
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
                "phase": "basic",
                "execution_model": "server_orchestrates_client_executes"
            }

            self.write(json.dumps({
                "workflow_id": workflow_id, 
                "status": "SUBMITTED",
                "execution_model": "server_orchestrates_client_executes",
                "server_role": "streamflow_orchestration",
                "client_role": "cwltool_execution"
            }))
            
            # Start orchestration with StreamFlow
            await self.start_orchestration(workflow_id)
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

    async def start_orchestration(self, workflow_id):
        """Start workflow orchestration: StreamFlow coordinates, client executes"""
        workflow = workflow_db.get(workflow_id)
        if not workflow:
            return

        try:
            # Create orchestration CWL (coordination logic only)
            orchestration_cwl = self._create_orchestration_cwl(workflow)
            
            # Create client instructions
            client_instructions = {
                "workflow_id": workflow_id,
                "execution_method": "cwltool",
                "cwl_workflow": workflow["cwl_workflow"],
                "inputs": workflow["inputs"],
                "local_execution": True,
                "data_privacy": "client_side_only"
            }
            
            # Submit to StreamFlow orchestrator
            result = await streamflow_orchestrator.orchestrate_workflow(
                workflow_id=workflow_id,
                orchestration_cwl=orchestration_cwl,
                client_instructions=client_instructions,
                metadata={"debug": True, "source": "basic_submission"}
            )
            
            # Update workflow status based on orchestration result
            if result["status"] == "ORCHESTRATION_ACTIVE":
                workflow["status"] = "ORCHESTRATING"
                workflow["orchestration_result"] = result
                workflow["client_execution_instructions"] = result.get("client_execution")
                workflow["started_at"] = datetime.now().isoformat()
                print(f"✅ StreamFlow orchestration started for workflow {workflow_id}")
                print(f"📋 Clients should use cwltool for execution")
            else:
                workflow["status"] = "FAILED"
                workflow["error"] = result.get("error", "Unknown orchestration error")
                print(f"❌ StreamFlow orchestration failed for workflow {workflow_id}: {workflow['error']}")
            
        except Exception as e:
            workflow["status"] = "FAILED"
            workflow["error"] = f"Orchestration error: {str(e)}"
            print(f"❌ Orchestration error for workflow {workflow_id}: {str(e)}")

    def _create_orchestration_cwl(self, workflow):
        """Create orchestration CWL for server-side coordination"""
        orchestration_cwl = {
            "cwlVersion": "v1.0",
            "class": "Workflow",
            "doc": "Server-side orchestration workflow - coordinates client execution",
            "inputs": {
                "workflow_id": "string",
                "client_instructions": "File"
            },
            "outputs": {
                "orchestration_status": {
                    "type": "string",
                    "outputSource": "coordinate/status"
                }
            },
            "steps": {
                "coordinate": {
                    "run": {
                        "class": "CommandLineTool",
                        "baseCommand": ["echo"],
                        "arguments": ["Orchestration active - clients execute with cwltool"],
                        "inputs": {
                            "workflow_id": "string",
                            "instructions": "File"
                        },
                        "outputs": {
                            "status": {
                                "type": "string",
                                "outputBinding": {"outputEval": "COORDINATING"}
                            }
                        }
                    },
                    "in": {
                        "workflow_id": "workflow_id",
                        "instructions": "client_instructions"
                    },
                    "out": ["status"]
                }
            }
        }
        
        return json.dumps(orchestration_cwl, indent=2)


class StreamflowSubmitProjectWorkflowHandler(BaseStreamflowHandler):
    @require_authentication('submit_workflow')
    async def post(self):
        """
        Submit a project-specific workflow: StreamFlow orchestrates, clients execute with cwltool
        Enhanced with DAL template support and distributed execution
        """
        try:
            body = json.loads(self.request.body.decode('utf-8'))
            project_id = body.get('project_id')
            cwl_workflow = body.get('cwl_workflow')
            inputs = body.get('inputs', {})
            metadata = body.get('metadata', {})
            use_dal_template = body.get('use_dal_template', False)
            dal_workflow_type = body.get('dal_workflow_type', 'train_query')

            # Validation
            if not project_id:
                self.set_status(400)
                self.write(json.dumps({"error": "project_id is required"}))
                return

            # Handle DAL template usage
            if use_dal_template:
                try:
                    cwl_workflow = DALWorkflowTemplate.get_dal_workflow_template(dal_workflow_type)
                    print(f"Using DAL template: {dal_workflow_type}")
                except ValueError as e:
                    self.set_status(400)
                    self.write(json.dumps({"error": str(e)}))
                    return
            elif not cwl_workflow:
                self.set_status(400)
                self.write(json.dumps({"error": "cwl_workflow is required (or use_dal_template=true)"}))
                return

            # Validate CWL workflow structure
            if not validate_cwl_workflow(cwl_workflow):
                self.set_status(400)
                self.write(json.dumps({"error": "Invalid CWL workflow format"}))
                return

            # Check if this is a DAL workflow
            is_dal_workflow = False
            if isinstance(cwl_workflow, str):
                cwl_data = json.loads(cwl_workflow)
            else:
                cwl_data = cwl_workflow
                
            is_dal_workflow = DALWorkflowTemplate.validate_dal_workflow(cwl_data)

            # Generate workflow ID
            workflow_id = str(uuid.uuid4())
            
            # Store workflow with project context
            workflow_db[workflow_id] = {
                "workflow_id": workflow_id,
                "project_id": project_id,
                "cwl_workflow": cwl_workflow,
                "inputs": inputs,
                "metadata": {
                    "creator": self.user_data.get('user_wallet'),
                    "user_role": self.user_data.get('user_role'),
                    "project_title": metadata.get('project_title'),
                    "al_config": metadata.get('al_config', {}),
                    "contributors": metadata.get('contributors', []),
                    "configuration_phase": metadata.get('configuration_phase', 'finalized'),
                    "smart_contract_address": metadata.get('smart_contract_address'),
                    "ipfs_dataset_hash": metadata.get('ipfs_dataset_hash'),
                    "ipfs_model_hash": metadata.get('ipfs_model_hash'),
                    "is_dal_workflow": is_dal_workflow,
                    "dal_workflow_type": dal_workflow_type if use_dal_template else None,
                    "created_at": datetime.now().isoformat(),
                    **metadata
                },
                "status": "PENDING",
                "created_at": datetime.now().isoformat(),
                "process": None,
                "output": None,
                "error": None,
                "phase": "configuration_complete",
                "execution_model": "server_orchestrates_client_executes"
            }

            response = {
                "workflow_id": workflow_id,
                "project_id": project_id,
                "status": "SUBMITTED",
                "message": "Project workflow submitted for StreamFlow orchestration. Clients will execute with cwltool.",
                "phase": "configuration_complete",
                "is_dal_workflow": is_dal_workflow,
                "execution_model": "server_orchestrates_client_executes",
                "server_role": "streamflow_orchestration_and_coordination",
                "client_role": "cwltool_execution_with_local_data"
            }

            if use_dal_template:
                response["dal_template_used"] = dal_workflow_type
                response["dal_features"] = DALWorkflowTemplate.get_workflow_info()

            self.write(json.dumps(response))
            
            # Start orchestration with StreamFlow
            await self.start_project_orchestration(workflow_id)
            
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

    async def start_project_orchestration(self, workflow_id):
        """Start project-specific workflow orchestration with StreamFlow"""
        workflow = workflow_db.get(workflow_id)
        if not workflow:
            return

        try:
            is_dal_workflow = workflow['metadata'].get('is_dal_workflow', False)
            
            if is_dal_workflow:
                # Use DAL-specific orchestration
                await self.orchestrate_dal_workflow(workflow_id)
            else:
                # Use standard orchestration
                await self.orchestrate_standard_workflow(workflow_id)
                
        except Exception as e:
            workflow["status"] = "FAILED"
            workflow["error"] = f"Project orchestration error: {str(e)}"

    async def orchestrate_dal_workflow(self, workflow_id):
        """Orchestrate DAL workflow: StreamFlow coordinates, clients execute with cwltool"""
        workflow = workflow_db.get(workflow_id)
        if not workflow:
            return

        try:
            # Prepare DAL coordination 
            dal_coordination = DALWorkflowTemplate.prepare_dal_coordination(workflow['metadata'])
            
            # Create DAL orchestration CWL (coordination only)
            dal_orchestration_cwl = self._create_dal_orchestration_cwl(workflow)
            
            # Create comprehensive client instructions for DAL
            client_instructions = {
                "workflow_id": workflow_id,
                "project_id": workflow.get("project_id"),
                "execution_method": "cwltool",
                "dal_workflow": True,
                "dal_type": workflow['metadata'].get('dal_workflow_type'),
                "cwl_files": {
                    "main_workflow": workflow["cwl_workflow"],
                    "modal_run": DALWorkflowTemplate.get_dal_workflow_template("modal_run")
                },
                "inputs": workflow["inputs"],
                "al_config": workflow['metadata'].get('al_config', {}),
                "client_execution_steps": [
                    "1. Receive DAL CWL files from orchestrator",
                    "2. Set up local environment with modal_run.py and dal_engine.py",
                    "3. Prepare client_inputs.json with LOCAL dataset paths",
                    "4. Execute: cwltool dal_train_query.cwl client_inputs.json",
                    "5. modal_run.py performs ML training/querying with LOCAL data",
                    "6. Return results (metrics, not raw data) to orchestrator",
                    "7. Wait for next DAL round coordination"
                ],
                "privacy_guarantees": {
                    "local_data_only": True,
                    "no_data_upload": True,
                    "results_only_sharing": True
                }
            }
            
            # Submit DAL orchestration to StreamFlow
            result = await streamflow_orchestrator.orchestrate_workflow(
                workflow_id=workflow_id,
                orchestration_cwl=dal_orchestration_cwl,
                client_instructions=client_instructions,
                metadata={
                    "debug": True,
                    "source": "dal_workflow",
                    "project_id": workflow.get("project_id"),
                    "dal_coordination": dal_coordination,
                    "creator": workflow['metadata'].get('creator')
                }
            )
            
            # Update workflow status
            if result["status"] == "ORCHESTRATION_ACTIVE":
                workflow["status"] = "ORCHESTRATING_DAL"
                workflow["orchestration_result"] = result
                workflow["dal_coordination"] = dal_coordination
                workflow["client_execution_instructions"] = result.get("client_execution")
                workflow["started_at"] = datetime.now().isoformat()
                
                print(f"✅ DAL StreamFlow orchestration started for workflow {workflow_id}")
                print(f"📋 Clients should execute DAL workflows with cwltool locally")
                print(f"🔒 Client data remains private and local")
            else:
                workflow["status"] = "FAILED"
                workflow["error"] = result.get("error", "Unknown DAL orchestration error")
                print(f"❌ DAL orchestration failed for workflow {workflow_id}")
            
        except Exception as e:
            workflow["status"] = "FAILED"
            workflow["error"] = f"DAL orchestration error: {str(e)}"
            print(f"❌ DAL orchestration error for workflow {workflow_id}: {str(e)}")

    async def orchestrate_standard_workflow(self, workflow_id):
        """Orchestrate standard workflow: StreamFlow coordinates, clients execute with cwltool"""
        workflow = workflow_db.get(workflow_id)
        if not workflow:
            return

        try:
            # Create standard orchestration CWL
            orchestration_cwl = self._create_standard_orchestration_cwl(workflow)
            
            # Create client instructions
            client_instructions = {
                "workflow_id": workflow_id,
                "project_id": workflow.get("project_id"),
                "execution_method": "cwltool",
                "cwl_workflow": workflow["cwl_workflow"],
                "inputs": workflow["inputs"],
                "local_execution": True,
                "creator": workflow['metadata'].get('creator')
            }
            
            # Submit standard orchestration to StreamFlow
            result = await streamflow_orchestrator.orchestrate_workflow(
                workflow_id=workflow_id,
                orchestration_cwl=orchestration_cwl,
                client_instructions=client_instructions,
                metadata={
                    "debug": True,
                    "source": "standard_workflow",
                    "project_id": workflow.get("project_id"),
                    "creator": workflow['metadata'].get('creator'),
                    "phase": workflow.get("phase", "unknown")
                }
            )
            
            # Update workflow status
            if result["status"] == "ORCHESTRATION_ACTIVE":
                workflow["status"] = "ORCHESTRATING"
                workflow["orchestration_result"] = result
                workflow["client_execution_instructions"] = result.get("client_execution")
                workflow["started_at"] = datetime.now().isoformat()
                print(f"✅ Standard StreamFlow orchestration started for workflow {workflow_id}")
                print(f"📋 Clients should execute with cwltool locally")
            else:
                workflow["status"] = "FAILED"
                workflow["error"] = result.get("error", "Unknown standard orchestration error")
                print(f"❌ Standard orchestration failed for workflow {workflow_id}")
            
        except Exception as e:
            workflow["status"] = "FAILED"
            workflow["error"] = f"Standard orchestration error: {str(e)}"
            print(f"❌ Standard orchestration error for workflow {workflow_id}: {str(e)}")

    def _create_dal_orchestration_cwl(self, workflow):
        """Create DAL orchestration CWL for server-side coordination"""
        orchestration_cwl = {
            "cwlVersion": "v1.0",
            "class": "Workflow",
            "doc": "DAL orchestration workflow - coordinates distributed active learning",
            "inputs": {
                "project_id": "string",
                "workflow_id": "string",
                "round_number": {"type": "int", "default": 1}
            },
            "outputs": {
                "coordination_status": {
                    "type": "string",
                    "outputSource": "coordinate_dal/status"
                }
            },
            "steps": {
                "coordinate_dal": {
                    "run": {
                        "class": "CommandLineTool",
                        "baseCommand": ["echo"],
                        "arguments": ["DAL orchestration active - clients execute training/querying with cwltool"],
                        "inputs": {
                            "project_id": "string",
                            "workflow_id": "string",
                            "round": "int"
                        },
                        "outputs": {
                            "status": {
                                "type": "string",
                                "outputBinding": {"outputEval": "COORDINATING_DAL"}
                            }
                        }
                    },
                    "in": {
                        "project_id": "project_id",
                        "workflow_id": "workflow_id", 
                        "round": "round_number"
                    },
                    "out": ["status"]
                }
            }
        }
        
        return json.dumps(orchestration_cwl, indent=2)

    def _create_standard_orchestration_cwl(self, workflow):
        """Create standard orchestration CWL for server-side coordination"""
        orchestration_cwl = {
            "cwlVersion": "v1.0",
            "class": "Workflow",
            "doc": "Standard orchestration workflow - coordinates client execution",
            "inputs": {
                "project_id": "string",
                "workflow_id": "string"
            },
            "outputs": {
                "coordination_status": {
                    "type": "string",
                    "outputSource": "coordinate_standard/status"
                }
            },
            "steps": {
                "coordinate_standard": {
                    "run": {
                        "class": "CommandLineTool",
                        "baseCommand": ["echo"],
                        "arguments": ["Standard orchestration active - clients execute with cwltool"],
                        "inputs": {
                            "project_id": "string",
                            "workflow_id": "string"
                        },
                        "outputs": {
                            "status": {
                                "type": "string",
                                "outputBinding": {"outputEval": "COORDINATING_STANDARD"}
                            }
                        }
                    },
                    "in": {
                        "project_id": "project_id",
                        "workflow_id": "workflow_id"
                    },
                    "out": ["status"]
                }
            }
        }
        
        return json.dumps(orchestration_cwl, indent=2)


class DALTemplateInfoHandler(BaseStreamflowHandler):
    def get(self):
        """Get information about available DAL workflow templates with distributed execution model"""
        try:
            dal_info = DALWorkflowTemplate.get_workflow_info()
            dal_info["execution_architecture"] = {
                "model": "server_orchestrates_client_executes",
                "server_role": {
                    "engine": "streamflow",
                    "responsibilities": [
                        "DAL round coordination",
                        "Multi-user orchestration",
                        "Smart contract integration", 
                        "Workflow state management",
                        "Resource allocation"
                    ]
                },
                "client_role": {
                    "engine": "cwltool",
                    "responsibilities": [
                        "CWL workflow execution",
                        "ML model training with local data",
                        "Active learning query execution",
                        "Local data privacy maintenance"
                    ]
                },
                "data_privacy": {
                    "local_only": True,
                    "no_data_upload": True,
                    "results_sharing_only": True
                },
                "supported_workflows": ["dal_train_query", "modal_run"],
                "client_requirements": ["cwltool", "modal_run.py", "dal_engine.py"]
            }
            
            self.write(json.dumps(dal_info, indent=2))
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)})) 