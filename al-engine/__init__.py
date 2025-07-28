# AL-Engine Package

"""
AL-Engine - Active Learning Engine for DVRE

This package provides active learning capabilities for the Decentralized Virtual
Research Environment (DVRE) system.

Main Components:
- ALEngine: Main engine class for managing AL workflows
- WorkflowRunner: Executes CWL workflows and direct Python execution
- OrchestratorClient: Handles remote computation via orchestrator
- al_iteration: Core active learning iteration logic

Usage:
    from al_engine import ALEngine
    
    engine = ALEngine(project_id="test", config_path="config.json")
    results = engine.run_full_workflow()
"""

__version__ = "1.0.0"
__author__ = "DVRE Team"

# Import main classes for easy access
from .main import ALEngine
from .workflow_runner import WorkflowRunner
from .orchestrator_client import OrchestratorClient

__all__ = [
    "ALEngine",
    "WorkflowRunner", 
    "OrchestratorClient"
] 