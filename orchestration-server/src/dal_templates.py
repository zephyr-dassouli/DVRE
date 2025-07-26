"""
DAL (Distributed Active Learning) Workflow Templates
Server-side orchestration templates that generate instructions for client-side AL engines
"""

import json
import os
import tempfile
from typing import Dict, Any, Optional

# Template CWL workflows for orchestration coordination
DAL_TRAIN_QUERY_CWL = """
cwlVersion: v1.2
class: Workflow

label: DAL Training and Query Workflow
doc: |
  Orchestration workflow that coordinates client-side modAL + scikit-learn execution.

inputs:
  labeled_data: File
  labeled_labels: File
  unlabeled_data: File
  config: File
  model_in: File?

outputs:
  model_out:
    type: File
    outputSource: al_step/model_out
    doc: "Updated model after training"
  query_indices:
    type: File
    outputSource: al_step/query_indices
    doc: "Indices of selected queries from the pool"

steps:
  al_step:
    run: modal_run.cwl
    in:
      labeled_data: labeled_data
      labeled_labels: labeled_labels
      unlabeled_data: unlabeled_data
      config: config
      model_in: model_in
    out: [model_out, query_indices]
"""

MODAL_RUN_CWL = """
cwlVersion: v1.2
class: CommandLineTool

label: modAL training and query coordination
doc: |
  Coordination tool that sends instructions to client-side modal_run.py.

baseCommand: python3
arguments:
  - orchestration_client_interface.py

inputs:
  labeled_data:
    type: File
    inputBinding:
      position: 1
      prefix: --labeled_data

  labeled_labels:
    type: File
    inputBinding:
      position: 2
      prefix: --labeled_labels

  unlabeled_data:
    type: File
    inputBinding:
      position: 3
      prefix: --unlabeled_data

  config:
    type: File
    inputBinding:
      position: 4
      prefix: --config

  model_in:
    type: File?
    inputBinding:
      position: 5
      prefix: --model_in

outputs:
  model_out:
    type: File
    outputBinding:
      glob: model_out.pkl

  query_indices:
    type: File
    outputBinding:
      glob: query_indices.npy

requirements:
  DockerRequirement:
    dockerPull: python:3.9-slim

stdout: /dev/null
"""

# Client-side AL engine instruction templates
CLIENT_AL_ENGINE_INSTRUCTIONS = {
    "start_querying": {
        "command": "query",
        "description": "Instruct client AL engine to start querying samples",
        "required_params": ["query_budget", "strategy"],
        "expected_client_files": ["modal_run.py", "dal_engine.py"]
    },
    "continue_querying": {
        "command": "query", 
        "description": "Instruct client AL engine to continue querying",
        "required_params": ["session_id", "query_budget"],
        "expected_client_files": ["modal_run.py", "dal_engine.py"]
    },
    "prompt_training": {
        "command": "train",
        "description": "Instruct client AL engine to train model",
        "required_params": ["session_id", "labeled_data"],
        "expected_client_files": ["modal_run.py", "dal_engine.py"]
    },
    "save_model": {
        "command": "save",
        "description": "Instruct client AL engine to save model",
        "required_params": ["session_id"],
        "expected_client_files": ["modal_run.py", "dal_engine.py"]
    }
}

class DALWorkflowTemplate:
    """Template manager for DAL Active Learning coordination (server-side orchestration)"""
    
    @staticmethod
    def validate_dal_workflow(cwl_workflow: Dict[str, Any]) -> bool:
        """Validate if a CWL workflow follows DAL coordination specifications"""
        try:
            # Check for DAL coordination patterns (not execution)
            if cwl_workflow.get('class') == 'Workflow':
                # Check for DAL coordination workflow structure
                steps = cwl_workflow.get('steps', {})
                if 'al_step' in steps:
                    al_step = steps['al_step']
                    if al_step.get('run') == 'modal_run.cwl':
                        return True
            elif cwl_workflow.get('class') == 'CommandLineTool':
                # Check for client coordination tool structure
                if 'orchestration_client_interface.py' in cwl_workflow.get('arguments', []):
                    return True
            
            return False
        except Exception:
            return False
    
    @staticmethod
    def get_dal_workflow_template(workflow_type: str = "train_query") -> str:
        """Get DAL coordination workflow template by type"""
        if workflow_type == "train_query":
            return DAL_TRAIN_QUERY_CWL
        elif workflow_type == "modal_run":
            return MODAL_RUN_CWL
        else:
            raise ValueError(f"Unknown DAL workflow type: {workflow_type}")
    
    @staticmethod
    def create_dal_config(project_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Create DAL configuration for client-side AL engine (file paths only)"""
        al_config = project_metadata.get('al_config', {})
        
        config = {
            "query_strategy": al_config.get('query_strategy', 'uncertainty_sampling'),
            "query_budget": al_config.get('query_budget', 10),
            "max_iterations": al_config.get('max_iterations', 50),
            "consensus_threshold": al_config.get('consensus_threshold', 0.7),
            "model_type": al_config.get('model_type', 'RandomForestClassifier'),
            "voting_strategy": al_config.get('voting_strategy', 'majority'),
            "label_space": al_config.get('label_space', ['positive', 'negative']),
            # Client-side execution instructions (file paths only)
            "client_al_engine": {
                "expected_files": ["modal_run.py", "dal_engine.py"],
                "execution_mode": "client_side",
                "coordination_endpoint": "/al-engine/command",
                "data_source": "local_client_files_only"
            },
            # Smart contract responsibilities
            "smart_contract_handles": {
                "voting_collection": True,
                "consensus_determination": True,
                "user_management": True,
                "labeled_sample_delivery": "smart_contract → client_al_engine"
            },
            # Orchestrator limitations
            "orchestrator_limitations": {
                "no_actual_data_storage": True,
                "no_voting_processing": True,
                "no_sample_management": True,
                "file_paths_only": True
            }
        }
        
        return config
    
    @staticmethod
    def prepare_dal_coordination(project_id: str, workflow_data: Dict[str, Any]) -> Dict[str, str]:
        """Prepare DAL coordination files (server-side orchestration only)"""
        # Create temporary directory for coordination files (not execution)
        temp_dir = tempfile.mkdtemp(prefix=f"dal_coordination_{project_id}_")
        
        file_paths = {}
        
        # Write coordination workflow files (CWL only)
        dal_workflow_path = os.path.join(temp_dir, "dal_train_query.cwl")
        with open(dal_workflow_path, 'w') as f:
            f.write(DAL_TRAIN_QUERY_CWL)
        file_paths['dal_workflow'] = dal_workflow_path
        
        modal_run_path = os.path.join(temp_dir, "modal_run.cwl") 
        with open(modal_run_path, 'w') as f:
            f.write(MODAL_RUN_CWL)
        file_paths['modal_run_cwl'] = modal_run_path
        
        # Write client instruction configuration (not execution script)
        config_data = DALWorkflowTemplate.create_dal_config(workflow_data.get('metadata', {}))
        config_path = os.path.join(temp_dir, "client_config.json")
        with open(config_path, 'w') as f:
            json.dump(config_data, f, indent=2)
        file_paths['client_config'] = config_path
        
        # Write client instruction templates
        instructions_path = os.path.join(temp_dir, "client_instructions.json")
        with open(instructions_path, 'w') as f:
            json.dump(CLIENT_AL_ENGINE_INSTRUCTIONS, f, indent=2)
        file_paths['client_instructions'] = instructions_path
        
        file_paths['temp_dir'] = temp_dir
        return file_paths
    
    @staticmethod
    def generate_client_instruction(command_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Generate instruction to send to client-side AL engine"""
        if command_type not in CLIENT_AL_ENGINE_INSTRUCTIONS:
            raise ValueError(f"Unknown command type: {command_type}")
        
        instruction_template = CLIENT_AL_ENGINE_INSTRUCTIONS[command_type]
        
        # Validate required parameters
        for param in instruction_template["required_params"]:
            if param not in parameters:
                raise ValueError(f"Missing required parameter: {param}")
        
        # Generate client instruction
        client_instruction = {
            "command": instruction_template["command"],
            "description": instruction_template["description"],
            "parameters": parameters,
            "expected_client_files": instruction_template["expected_client_files"],
            "coordination_mode": "orchestrator_to_client",
            "timestamp": parameters.get("timestamp"),
            "session_id": parameters.get("session_id"),
            "project_id": parameters.get("project_id")
        }
        
        return client_instruction
    
    @staticmethod
    def get_workflow_info() -> Dict[str, Any]:
        """Get information about available DAL coordination templates"""
        return {
            "templates": {
                "train_query": {
                    "name": "DAL Training and Query Coordination Workflow",
                    "description": "Coordinates client-side modAL + scikit-learn execution",
                    "inputs": ["labeled_data", "labeled_labels", "unlabeled_data", "config", "model_in?"],
                    "outputs": ["model_out", "query_indices"],
                    "execution_location": "client_side"
                },
                "modal_run": {
                    "name": "modAL Coordination Tool", 
                    "description": "CommandLineTool that coordinates with client-side modal_run.py",
                    "base_command": "python3 orchestration_client_interface.py",
                    "execution_location": "client_side"
                }
            },
            "client_side_components": {
                "modal_run.py": "Client-side modAL execution script (provided by you)",
                "dal_engine.py": "Client-side AL engine listener (provided by you)"
            },
            "supported_strategies": ["uncertainty_sampling"],
            "supported_models": ["RandomForestClassifier"],
            "supported_voting": ["majority", "consensus"],
            "coordination_mode": "server_orchestrates_client_executes",
            "default_config": {
                "query_strategy": "uncertainty_sampling", 
                "query_budget": 10,
                "max_iterations": 50,
                "consensus_threshold": 0.7,
                "execution_mode": "client_side"
            }
        } 