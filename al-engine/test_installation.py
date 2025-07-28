#!/usr/bin/env python3
# test_installation.py - AL-Engine Installation Test

import os
import sys
import numpy as np
import json
import tempfile
import shutil
from pathlib import Path

def test_imports():
    """Test that all required modules can be imported"""
    print("Testing imports...")
    
    try:
        import numpy
        print("  ✓ numpy")
    except ImportError:
        print("  ✗ numpy - FAILED")
        return False
        
    try:
        import sklearn
        print("  ✓ scikit-learn")
    except ImportError:
        print("  ✗ scikit-learn - FAILED")
        return False
        
    try:
        import joblib
        print("  ✓ joblib")
    except ImportError:
        print("  ✗ joblib - FAILED")
        return False
        
    try:
        import modAL
        print("  ✓ modAL")
    except ImportError:
        print("  ✗ modAL - FAILED")
        return False
        
    try:
        from main import ALEngine
        print("  ✓ AL-Engine main module")
    except ImportError as e:
        print(f"  ✗ AL-Engine main module - FAILED: {e}")
        return False
        
    try:
        from workflow_runner import WorkflowRunner
        print("  ✓ WorkflowRunner")
    except ImportError as e:
        print(f"  ✗ WorkflowRunner - FAILED: {e}")
        return False
        
    return True

def test_al_iteration():
    """Test the core AL iteration script"""
    print("\nTesting AL iteration script...")
    
    # Create temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Generate sample data
        np.random.seed(42)
        n_samples = 100
        n_features = 4
        
        # Create labeled data (small initial set)
        X_labeled = np.random.randn(10, n_features)
        y_labeled = np.random.choice([0, 1], 10)
        
        # Create unlabeled data
        X_unlabeled = np.random.randn(n_samples - 10, n_features)
        
        # Save data files
        labeled_data_file = temp_path / "labeled_data.npy"
        labeled_labels_file = temp_path / "labeled_labels.npy"
        unlabeled_data_file = temp_path / "unlabeled_data.npy"
        config_file = temp_path / "test_config.json"
        
        np.save(labeled_data_file, X_labeled)
        np.save(labeled_labels_file, y_labeled)
        np.save(unlabeled_data_file, X_unlabeled)
        
        # Create config
        config = {
            "n_queries": 3,
            "query_strategy": "uncertainty_sampling"
        }
        with open(config_file, 'w') as f:
            json.dump(config, f)
        
        # Test AL iteration import and basic functionality
        try:
            import al_iteration
            print("  ✓ AL iteration module imported")
            
            # Test config parsing
            parsed_config = al_iteration.parse_config(str(config_file))
            assert parsed_config["n_queries"] == 3
            print("  ✓ Configuration parsing")
            
            # Test data loading
            loaded_data = al_iteration.load_data(str(labeled_data_file))
            assert loaded_data.shape == X_labeled.shape
            print("  ✓ Data loading")
            
            print("  ✓ AL iteration script basic functionality")
            return True
            
        except Exception as e:
            print(f"  ✗ AL iteration test failed: {e}")
            return False

def test_workflow_runner():
    """Test the workflow runner"""
    print("\nTesting WorkflowRunner...")
    
    try:
        from workflow_runner import WorkflowRunner
        
        runner = WorkflowRunner()
        print("  ✓ WorkflowRunner initialization")
        
        # Test cwltool availability check
        cwl_available = runner.check_cwltool_available()
        if cwl_available:
            print("  ✓ cwltool is available")
        else:
            print("  ! cwltool not available (direct Python execution will be used)")
        
        return True
        
    except Exception as e:
        print(f"  ✗ WorkflowRunner test failed: {e}")
        return False

def test_orchestrator_client():
    """Test the orchestrator client"""
    print("\nTesting OrchestratorClient...")
    
    try:
        from orchestrator_client import OrchestratorClient
        
        client = OrchestratorClient()
        print("  ✓ OrchestratorClient initialization")
        
        # Test health check (this may fail if orchestrator is not available)
        try:
            health = client.check_orchestrator_health()
            if health:
                print("  ✓ Orchestrator is healthy")
            else:
                print("  ! Orchestrator not available (expected for local testing)")
        except Exception:
            print("  ! Orchestrator connection failed (expected for local testing)")
        
        return True
        
    except Exception as e:
        print(f"  ✗ OrchestratorClient test failed: {e}")
        return False

def test_al_engine():
    """Test the main AL-Engine class"""
    print("\nTesting ALEngine class...")
    
    try:
        # Create temporary config
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            config = {
                "n_queries": 3,
                "max_iterations": 5,
                "query_strategy": "uncertainty_sampling"
            }
            json.dump(config, f)
            config_path = f.name
        
        try:
            from main import ALEngine
            
            # Test initialization
            engine = ALEngine("test-project", config_path, "local")
            print("  ✓ ALEngine initialization")
            
            # Test configuration loading
            assert engine.config["n_queries"] == 3
            print("  ✓ Configuration loading")
            
            # Test working directory creation
            assert engine.work_dir.exists()
            print("  ✓ Working directory creation")
            
            return True
            
        finally:
            # Cleanup
            os.unlink(config_path)
            
    except Exception as e:
        print(f"  ✗ ALEngine test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("AL-Engine Installation Test")
    print("=" * 40)
    
    tests = [
        ("Import Test", test_imports),
        ("AL Iteration Test", test_al_iteration),
        ("WorkflowRunner Test", test_workflow_runner),
        ("OrchestratorClient Test", test_orchestrator_client),
        ("ALEngine Test", test_al_engine)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"\n{test_name}: PASSED")
            else:
                print(f"\n{test_name}: FAILED")
        except Exception as e:
            print(f"\n{test_name}: ERROR - {e}")
    
    print("\n" + "=" * 40)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! AL-Engine is ready to use.")
        return 0
    else:
        print("❌ Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 