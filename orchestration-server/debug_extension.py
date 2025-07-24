#!/usr/bin/env python3
"""
Debug script to test DVRE orchestration server extension loading
"""

import sys
import traceback
import json

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
        from dvre_orchestration_server.streamflow_handler import (
            StreamflowSubmitHandler,
            StreamflowStatusHandler,
            StreamflowListWorkflowsHandler,
            validate_cwl_workflow
        )
        print("✓ Handler classes imported successfully")
        
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

def main():
    """Run all diagnostic tests"""
    print("DVRE Orchestration Server Extension Diagnostics")
    print("=" * 50)
    
    all_passed = True
    
    all_passed &= test_imports()
    all_passed &= test_extension_loading()
    all_passed &= test_handler_creation()
    all_passed &= test_mock_app()
    
    print("\n" + "=" * 50)
    if all_passed:
        print("✓ All tests passed! Extension should work correctly.")
    else:
        print("✗ Some tests failed. Check the errors above.")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main()) 