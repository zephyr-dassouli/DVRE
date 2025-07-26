#!/usr/bin/env python3
"""
Debug script to test DVRE orchestration server extension loading
"""

import sys
import os
import traceback
import json

def check_environment():
    """Check if we're running in the container environment"""
    print("=== Environment Check ===")
    
    # Check if we're in Docker container
    in_container = os.path.exists('/.dockerenv') or os.path.exists('/app')
    print(f"Running in container: {in_container}")
    
    if in_container:
        print("Container paths:")
        print(f"  Current directory: {os.getcwd()}")
        print(f"  App directory exists: {os.path.exists('/app')}")
        print(f"  Source directory exists: {os.path.exists('/app/src')}")
        
        # Add container paths
        if '/app/src' not in sys.path:
            sys.path.insert(0, '/app/src')
        if '/app' not in sys.path:
            sys.path.insert(0, '/app')
    else:
        print("⚠️  Not running in container - some tests may fail")
        print("   This is normal when testing locally")
    
    print(f"Python path: {sys.path[:3]}...")  # Show first 3 paths
    return in_container

def test_imports():
    """Test if all required imports work"""
    print("=== Testing Imports ===")
    
    try:
        import tornado
        print(f"✓ tornado version: {tornado.version}")
    except ImportError as e:
        print(f"✗ tornado import failed: {e}")
        return False
    
    try:
        import jupyter_server
        print(f"✓ jupyter_server version: {jupyter_server.__version__}")
    except ImportError as e:
        print(f"✗ jupyter_server import failed: {e}")
        return False
    
    try:
        from jupyter_server.base.handlers import APIHandler
        print("✓ APIHandler import successful")
    except ImportError as e:
        print(f"✗ APIHandler import failed: {e}")
        return False
    
    try:
        import uuid, json, subprocess, tempfile, os
        from datetime import datetime
        print("✓ Standard library imports successful")
    except ImportError as e:
        print(f"✗ Standard library import failed: {e}")
        return False
    
    return True

def test_extension_loading():
    """Test if the extension can be loaded"""
    print("\n=== Testing Extension Loading ===")
    
    try:
        # Add the src directory to the path
        sys.path.insert(0, '/app/src')
        print("✓ Added /app/src to Python path")
        
        import dvre_orchestration_server
        print("✓ dvre_orchestration_server module imported")
        
        from dvre_orchestration_server.streamflow_handler import setup_handlers
        print("✓ setup_handlers imported successfully")
        
        return True
    except Exception as e:
        print(f"✗ Extension loading failed: {e}")
        traceback.print_exc()
        return False

def test_handler_creation():
    """Test if handlers can be created"""
    print("\n=== Testing Handler Creation ===")
    
    try:
        sys.path.insert(0, '/app/src')
        
        # Import from modular handlers
        from dvre_orchestration_server.workflow_handlers import (
            StreamflowSubmitHandler,
            StreamflowSubmitProjectWorkflowHandler,
            validate_cwl_workflow
        )
        from dvre_orchestration_server.monitoring_handlers import (
            StreamflowStatusHandler,
            StreamflowListWorkflowsHandler,
            StreamflowHomeHandler
        )
        from dvre_orchestration_server.al_engine_handlers import (
            ALEngineCommandHandler
        )
        
        print("✓ Handler classes imported successfully from modular architecture")
        
        # Test CWL validation
        test_cwl = {
            "cwlVersion": "v1.0",
            "class": "CommandLineTool",
            "baseCommand": "echo"
        }
        
        if validate_cwl_workflow(test_cwl):
            print("✓ CWL validation working")
        else:
            print("✗ CWL validation failed")
            return False
        
        print("✓ All modular handlers successfully imported and tested")
        return True
    except Exception as e:
        print(f"✗ Handler creation failed: {e}")
        traceback.print_exc()
        return False

def test_mock_app():
    """Test with a mock Jupyter app"""
    print("\n=== Testing with Mock App ===")
    
    try:
        sys.path.insert(0, '/app/src')
        from dvre_orchestration_server import _load_jupyter_server_extension
        
        # Create a mock server app
        class MockApp:
            def __init__(self):
                self.web_app = MockWebApp()
                self.log = MockLogger()
        
        class MockWebApp:
            def __init__(self):
                self.settings = {"base_url": "/"}
            
            def add_handlers(self, host_pattern, handlers):
                print(f"✓ Mock add_handlers called with {len(handlers)} handlers")
                for pattern, handler_class in handlers:
                    print(f"  - {pattern} -> {handler_class.__name__}")
        
        class MockLogger:
            def info(self, msg):
                print(f"INFO: {msg}")
            
            def error(self, msg):
                print(f"ERROR: {msg}")
        
        mock_app = MockApp()
        _load_jupyter_server_extension(mock_app)
        print("✓ Extension loaded successfully with mock app")
        return True
        
    except Exception as e:
        print(f"✗ Mock app test failed: {e}")
        traceback.print_exc()
        return False

def test_dal_features():
    """Test DAL compliance features"""
    print("\n=== Testing DAL Compliance Features ===")
    
    try:
        sys.path.insert(0, '/app/src')
        from dvre_orchestration_server.dal_templates import DALWorkflowTemplate
        from dvre_orchestration_server.workflow_handlers import DALTemplateInfoHandler
        
        # Test DAL template functionality
        template_info = DALWorkflowTemplate.get_workflow_info()
        if 'coordination_mode' in str(template_info):
            print("✓ DAL templates working")
        else:
            print("✗ DAL templates missing coordination_mode")
            return False
            
        # Test DAL workflow validation
        test_dal_cwl = {
            "cwlVersion": "v1.2", 
            "class": "Workflow",
            "steps": {
                "al_step": {
                    "run": "modal_run.cwl"
                }
            }
        }
        
        if DALWorkflowTemplate.validate_dal_workflow(test_dal_cwl):
            print("✓ DAL workflow validation working")
        else:
            print("✗ DAL workflow validation failed")
            return False
            
        print("✓ DAL compliance features working correctly")
        return True
        
    except Exception as e:
        print(f"✗ DAL features test failed: {e}")
        traceback.print_exc()
        return False

def main():
    """Run all diagnostic tests"""
    print("DVRE Orchestration Server Extension Diagnostics")
    print("=" * 50)
    
    # Check environment first
    in_container = check_environment()
    
    all_passed = True
    
    all_passed &= test_imports()
    
    # Only run extension-specific tests if in container
    if in_container:
        all_passed &= test_extension_loading()
        all_passed &= test_handler_creation()
        all_passed &= test_mock_app()
        all_passed &= test_dal_features()
    else:
        print("\n⚠️  Skipping container-specific tests (not in container)")
        print("   Run this script inside the Docker container for full testing")
    
    print("\n" + "=" * 50)
    if all_passed:
        print("✓ All tests passed! Extension should work correctly.")
    else:
        print("✗ Some tests failed. Check the errors above.")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main()) 