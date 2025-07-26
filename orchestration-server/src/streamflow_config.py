#!/usr/bin/env python3
"""
StreamFlow Configuration and Integration Module
StreamFlow on server-side for ORCHESTRATION, cwltool on client-side for EXECUTION
"""

import os
import yaml
import tempfile
import asyncio
import subprocess
import json
from typing import Dict, Any, Optional, List
from datetime import datetime

class StreamFlowConfig:
    """Configuration manager for StreamFlow orchestration integration"""
    
    def __init__(self):
        self.config_file = self._get_config_file()
        self.config = self._load_config()
    
    def _get_config_file(self) -> str:
        """Get StreamFlow configuration file path"""
        # Check environment variable first
        if 'STREAMFLOW_CONFIG' in os.environ:
            return os.environ['STREAMFLOW_CONFIG']
        
        # Default config file
        config_file = os.path.join(os.path.dirname(__file__), '..', 'streamflow.yml')
        return os.path.abspath(config_file)
    
    def _load_config(self) -> Dict[str, Any]:
        """Load StreamFlow configuration for orchestration"""
        default_config = {
            "version": "v1.0",
            "workflows": {},
            "deployments": {
                "orchestration": {
                    "type": "local",
                    "description": "Server-side orchestration only"
                }
            }
        }
        
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    return yaml.safe_load(f) or default_config
            except Exception as e:
                print(f"Warning: Error loading StreamFlow config: {e}")
                return default_config
        else:
            # Create default config
            self._create_default_config()
            return default_config
    
    def _create_default_config(self):
        """Create default StreamFlow configuration file for orchestration"""
        default_config = {
            "version": "v1.0",
            "workflows": {},
            "deployments": {
                "orchestration": {
                    "type": "local",
                    "config": {
                        "workdir": "/tmp/streamflow/dvre-orchestration",
                        "description": "Server-side orchestration and coordination"
                    }
                }
            },
            "execution_model": {
                "server_role": "orchestration_only",
                "client_role": "execution_with_cwltool",
                "data_locality": "client_side_only",
                "ml_execution": "distributed_to_clients"
            }
        }
        
        try:
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            with open(self.config_file, 'w') as f:
                yaml.safe_dump(default_config, f, default_flow_style=False)
            print(f"Created StreamFlow orchestration config: {self.config_file}")
        except Exception as e:
            print(f"Warning: Could not create StreamFlow config: {e}")


class StreamFlowOrchestrator:
    """StreamFlow orchestrator for coordination, clients use cwltool for execution"""
    
    def __init__(self, config: Optional[StreamFlowConfig] = None):
        self.config = config or StreamFlowConfig()
        self.active_orchestrations: Dict[str, Dict[str, Any]] = {}
    
    async def orchestrate_workflow(self, workflow_id: str, orchestration_cwl: str, 
                                 client_instructions: Dict[str, Any], 
                                 metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Orchestrate workflow: StreamFlow coordinates, clients execute with cwltool"""
        try:
            # Create orchestration files (coordination logic only)
            orchestration_file = await self._create_temp_file(orchestration_cwl, suffix='.cwl')
            instructions_file = await self._create_temp_file(
                json.dumps(client_instructions, indent=2), suffix='.json'
            )
            
            # Create StreamFlow orchestration configuration
            streamflow_config = await self._create_orchestration_config(
                workflow_id, orchestration_file
            )
            
            # Execute orchestration workflow (coordination only)
            result = await self._execute_orchestration(
                workflow_id, streamflow_config, instructions_file, metadata
            )
            
            # Generate client execution instructions
            client_exec_instructions = await self._generate_client_instructions(
                workflow_id, client_instructions, metadata
            )
            
            # Store orchestration info
            self.active_orchestrations[workflow_id] = {
                "orchestration_file": orchestration_file,
                "instructions_file": instructions_file,
                "streamflow_config": streamflow_config,
                "client_instructions": client_exec_instructions,
                "metadata": metadata or {},
                "started_at": datetime.now().isoformat(),
                "status": "ORCHESTRATING"
            }
            
            # Add client execution instructions to result
            result["client_execution"] = client_exec_instructions
            result["execution_model"] = "server_orchestrates_client_executes"
            
            return result
            
        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e),
                "workflow_id": workflow_id,
                "execution_model": "orchestration_failed"
            }
    
    async def _create_temp_file(self, content: str, suffix: str = '.tmp') -> str:
        """Create temporary file with content"""
        with tempfile.NamedTemporaryFile(mode='w', suffix=suffix, delete=False) as f:
            f.write(content)
            return f.name
    
    async def _create_orchestration_config(self, workflow_id: str, orchestration_file: str) -> str:
        """Create StreamFlow configuration for orchestration workflow"""
        orchestration_config = {
            "version": "v1.0",
            "workflows": {
                workflow_id: {
                    "type": "cwl",
                    "config": {
                        "file": orchestration_file
                    },
                    "bindings": [
                        {
                            "step": "/",
                            "target": {
                                "deployment": "orchestration"
                            }
                        }
                    ]
                }
            },
            "deployments": {
                "orchestration": {
                    "type": "local",
                    "config": {
                        "workdir": "/tmp/streamflow/orchestration",
                        "description": "Server-side orchestration only"
                    }
                }
            }
        }
        
        config_file = await self._create_temp_file(yaml.dump(orchestration_config), suffix='.yml')
        return config_file
    
    async def _execute_orchestration(self, workflow_id: str, config_file: str, 
                                   instructions_file: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute orchestration workflow using StreamFlow (coordination only)"""
        try:
            # Check if StreamFlow is available for orchestration
            if not await self._check_streamflow_available():
                return await self._fallback_orchestration(workflow_id, instructions_file, metadata)
            
            # Build StreamFlow orchestration command
            cmd = [
                "streamflow", "run",
                "--streamflow-file", config_file,
                workflow_id,
                instructions_file
            ]
            
            # Add verbose output for debugging
            if metadata and metadata.get('debug', False):
                cmd.extend(["--verbose"])
            
            # Execute StreamFlow orchestration
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=tempfile.gettempdir()
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                return {
                    "status": "ORCHESTRATION_ACTIVE",
                    "workflow_id": workflow_id,
                    "orchestration_output": stdout.decode('utf-8'),
                    "execution_engine": "streamflow_orchestration",
                    "command": " ".join(cmd),
                    "note": "Server orchestrates, clients execute with cwltool"
                }
            else:
                return {
                    "status": "ORCHESTRATION_FAILED",
                    "workflow_id": workflow_id,
                    "error": stderr.decode('utf-8'),
                    "command": " ".join(cmd)
                }
                
        except Exception as e:
            return {
                "status": "ORCHESTRATION_ERROR",
                "workflow_id": workflow_id,
                "error": f"StreamFlow orchestration error: {str(e)}"
            }
    
    async def _generate_client_instructions(self, workflow_id: str, client_instructions: Dict[str, Any], 
                                          metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate instructions for clients to execute with cwltool"""
        
        return {
            "execution_method": "cwltool",
            "workflow_id": workflow_id,
            "instructions": {
                "command": "cwltool",
                "args": ["dal_train_query.cwl", "client_inputs.json"],
                "working_directory": "client_workspace",
                "environment": {
                    "DVRE_WORKFLOW_ID": workflow_id,
                    "DVRE_EXECUTION_MODE": "client_side",
                    "PYTHONPATH": "./dal_engine"
                }
            },
            "required_files": [
                "dal_train_query.cwl",
                "modal_run.cwl", 
                "client_inputs.json",
                "modal_run.py",
                "dal_engine.py"
            ],
            "data_requirements": {
                "local_datasets_only": True,
                "no_data_upload": True,
                "privacy_preserved": True
            },
            "execution_flow": [
                "1. Receive CWL files and instructions from orchestrator",
                "2. Prepare local client_inputs.json with local data paths",
                "3. Execute: cwltool dal_train_query.cwl client_inputs.json",
                "4. modal_run.py executes with local datasets",
                "5. Send results (NOT raw data) back to orchestrator",
                "6. Orchestrator coordinates next DAL round"
            ],
            "client_responsibilities": [
                "CWL workflow execution with cwltool",
                "ML model training with local data",
                "Active learning query execution",
                "Local data privacy maintenance"
            ],
            "server_responsibilities": [
                "DAL round coordination",
                "Multi-user orchestration", 
                "Smart contract integration",
                "Workflow state management"
            ]
        }
    
    async def _check_streamflow_available(self) -> bool:
        """Check if StreamFlow is available for orchestration"""
        try:
            process = await asyncio.create_subprocess_exec(
                "streamflow", "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()
            return process.returncode == 0
        except FileNotFoundError:
            return False
        except Exception:
            return False
    
    async def _fallback_orchestration(self, workflow_id: str, instructions_file: str, 
                                    metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Fallback orchestration if StreamFlow is not available"""
        try:
            # Simple orchestration without StreamFlow
            print(f"🔧 Fallback orchestration for workflow {workflow_id}")
            
            return {
                "status": "ORCHESTRATION_ACTIVE",
                "workflow_id": workflow_id,
                "execution_engine": "simple_orchestration_fallback",
                "warning": "StreamFlow not available, using simple orchestration",
                "note": "Clients should still use cwltool for execution"
            }
                
        except Exception as e:
            return {
                "status": "ORCHESTRATION_FAILED",
                "workflow_id": workflow_id,
                "error": f"Fallback orchestration error: {str(e)}"
            }
    
    async def get_orchestration_status(self, workflow_id: str) -> Dict[str, Any]:
        """Get status of an orchestration"""
        if workflow_id not in self.active_orchestrations:
            return {"status": "NOT_FOUND", "workflow_id": workflow_id}
        
        orchestration_info = self.active_orchestrations[workflow_id]
        
        return {
            "workflow_id": workflow_id,
            "status": orchestration_info.get("status", "UNKNOWN"),
            "started_at": orchestration_info.get("started_at"),
            "execution_model": "server_orchestrates_client_executes",
            "server_role": "coordination_and_orchestration",
            "client_role": "cwltool_execution_with_local_data",
            "metadata": orchestration_info.get("metadata", {})
        }
    
    def cleanup_orchestration(self, workflow_id: str):
        """Clean up temporary orchestration files"""
        if workflow_id in self.active_orchestrations:
            orchestration_info = self.active_orchestrations[workflow_id]
            
            # Clean up temporary files
            for file_key in ['orchestration_file', 'instructions_file', 'streamflow_config']:
                if file_key in orchestration_info:
                    try:
                        os.unlink(orchestration_info[file_key])
                    except OSError:
                        pass
            
            del self.active_orchestrations[workflow_id]


# Global StreamFlow orchestrator instance (server-side coordination)
streamflow_orchestrator = StreamFlowOrchestrator() 