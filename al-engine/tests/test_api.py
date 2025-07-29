#!/usr/bin/env python3
"""
Test script for AL-Engine HTTP API server (Local execution only)
"""

import requests
import json
import time
import sys

def test_al_engine_api():
    """Test the AL-Engine HTTP API endpoints"""
    base_url = "http://localhost:5050"
    
    print("🧪 Testing AL-Engine HTTP API (Local execution)...")
    print(f"📡 Base URL: {base_url}")
    
    # Test 1: Health check
    print("\n1. Testing health endpoint...")
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            if data.get('computation_mode') != 'local':
                print("⚠️ Warning: Expected local computation mode")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check error: {e}")
        print("💡 Make sure AL-Engine server is running with:")
        print("   python main.py --project_id test-project --config example_config.json --server")
        return False
    
    # Test 2: Status endpoint
    print("\n2. Testing status endpoint...")
    try:
        response = requests.get(f"{base_url}/status", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status check passed: {data.get('project_id', 'unknown')}")
            print(f"   Computation mode: {data.get('computation_mode', 'unknown')}")
        else:
            print(f"❌ Status check failed: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Status check error: {e}")
    
    # Test 3: Config endpoint
    print("\n3. Testing config endpoint...")
    try:
        response = requests.get(f"{base_url}/config", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Config check passed: {len(data)} config items")
        else:
            print(f"❌ Config check failed: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Config check error: {e}")
    
    # Test 4: Start iteration endpoint
    print("\n4. Testing start_iteration endpoint (local execution)...")
    try:
        payload = {
            "iteration": 1,
            "project_id": "test-project",
            "config_override": {
                "n_queries": 2,
                "query_strategy": "uncertainty_sampling",
                "label_space": ["positive", "negative"]
            }
        }
        
        print(f"📤 Sending payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(
            f"{base_url}/start_iteration",
            json=payload,
            timeout=30  # Longer timeout for actual execution
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Start iteration passed:")
            print(f"   Success: {data.get('success', False)}")
            print(f"   Iteration: {data.get('iteration', 'unknown')}")
            print(f"   Message: {data.get('message', 'no message')}")
            if data.get('result'):
                print(f"   Result: {data['result']}")
        else:
            print(f"❌ Start iteration failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'unknown error')}")
            except:
                print(f"   Response: {response.text}")
                
    except requests.exceptions.RequestException as e:
        print(f"❌ Start iteration error: {e}")
    
    # Test 5: Results endpoint
    print("\n5. Testing results endpoint...")
    try:
        response = requests.get(f"{base_url}/results/1", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Results check passed for iteration 1:")
            print(f"   Files: {data.get('files', {})}")
        else:
            print(f"⚠️ Results check returned {response.status_code} (expected if no results yet)")
    except requests.exceptions.RequestException as e:
        print(f"❌ Results check error: {e}")
    
    # Test 6: Submit labels endpoint
    print("\n6. Testing submit_labels endpoint...")
    try:
        # Sample labeled data that DAL would send back
        labeled_samples = [
            {
                "sample_id": "sample_1_1_123456",
                "sample_data": {
                    "features": [1.2, 3.4, 5.6, 7.8],
                    "text": "Sample text content"
                },
                "label": "positive",
                "original_index": 42
            },
            {
                "sample_id": "sample_1_2_123456", 
                "sample_data": {
                    "features": [2.1, 4.3, 6.5, 8.7],
                    "text": "Another sample text"
                },
                "label": "negative",
                "original_index": 73
            }
        ]
        
        payload = {
            "iteration": 1,
            "project_id": "test-project",
            "labeled_samples": labeled_samples
        }
        
        print(f"📤 Sending {len(labeled_samples)} labeled samples...")
        
        response = requests.post(
            f"{base_url}/submit_labels",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Submit labels passed:")
            print(f"   Success: {data.get('success', False)}")
            print(f"   Samples processed: {data.get('samples_processed', 0)}")
            print(f"   Next iteration ready: {data.get('next_iteration_ready', False)}")
            print(f"   Message: {data.get('message', 'no message')}")
        else:
            print(f"❌ Submit labels failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'unknown error')}")
            except:
                print(f"   Response: {response.text}")
                
    except requests.exceptions.RequestException as e:
        print(f"❌ Submit labels error: {e}")
    
    print("\n🎉 AL-Engine API test completed (Local execution)!")
    print("📝 Note: All processing happens locally - no remote dependencies")
    return True

if __name__ == "__main__":
    if test_al_engine_api():
        print("✅ Tests completed successfully")
        sys.exit(0)
    else:
        print("❌ Tests failed")
        sys.exit(1) 