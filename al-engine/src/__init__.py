# AL-Engine Package

"""
AL-Engine - Active Learning Engine for DVRE

This package provides active learning capabilities for the Decentralized Virtual
Research Environment (DVRE) system. Local execution only.

Main Components:
- ALEngine: Main engine class for managing AL workflows (local execution)
- ALEngineServer: HTTP API server for DAL integration (local execution)
- WorkflowRunner: Executes CWL workflows locally

Usage:
    from al_engine import ALEngine
    
    engine = ALEngine(project_id="test", config_path="config.json")
    results = engine.run_full_workflow()
    
    # Or use HTTP API server mode
    from al_engine import ALEngineServer
    
    server = ALEngineServer(project_id="test", config_path="config.json")
    server.start_server()
"""

__version__ = "1.0.0"
__author__ = "DVRE Team"

# Import main classes for easy access
from .main import ALEngine, ALEngineServer
from .workflow_runner import WorkflowRunner

__all__ = [
    "ALEngine",
    "ALEngineServer", 
    "WorkflowRunner"
] 