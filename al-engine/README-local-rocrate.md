# Local RO-Crate Saver for AL-Engine

This service saves RO-Crate bundles locally to the `al-engine/project-files` directory for the AL-Engine to access.

## Overview

When you deploy a project in DVRE, two things happen:
1. **IPFS Upload**: The RO-Crate is uploaded to IPFS (already implemented)
2. **Local Save**: The same RO-Crate is saved locally to `al-engine/project-files` (new feature)

This ensures the AL-Engine has direct access to project files without needing to download from IPFS.

## Architecture

```
DVRE Deployment Flow:
1. User clicks "Deploy" in Project Deployment
2. RO-Crate is created with project configuration
3. RO-Crate is uploaded to IPFS ✅
4. RO-Crate is saved locally to al-engine/project-files ✅ (NEW)
5. Smart contracts are updated
6. AL-Engine can access files directly from project-files/
```

## File Structure

After deployment, projects are saved with this structure:

```
al-engine/project-files/
├── 0x1234...ProjectAddress1/
│   ├── ro-crate-metadata.json          # Main RO-Crate metadata
│   ├── config/
│   │   ├── config.json                 # Project configuration for AL-Engine
│   │   ├── extensions-config.json      # Extension configurations
│   │   └── models/
│   │       └── model-config.json       # Model configurations
│   ├── workflows/
│   │   └── active_learning.cwl         # CWL workflow files
│   ├── inputs/
│   │   ├── inputs.json                 # AL input configuration
│   │   └── datasets/
│   │       └── dataset-metadata.json   # Dataset metadata (not actual data)
│   └── project-manifest.json           # Project summary and file listing
└── 0x5678...ProjectAddress2/
    └── ... (same structure)
```

## Starting the Backend Service

The local RO-Crate saving requires a Node.js backend service to handle file system operations.

### 1. Start the Service

```bash
cd al-engine
node local-rocrate-saver.js
```

This starts an HTTP server on `http://localhost:3001` that handles file saving.

### 2. Server Output

```
🚀 Local RO-Crate Saver running on http://localhost:3001
📂 Project files directory: /path/to/al-engine/project-files
Available endpoints:
  POST /save-rocrate - Save RO-Crate bundle
  GET /projects - List all projects
  GET /projects/:id - Check if project exists
  DELETE /projects/:id - Remove project
```

## API Endpoints

### Save RO-Crate Bundle
```bash
POST http://localhost:3001/save-rocrate
Content-Type: application/json

{
  "projectId": "0x1234...ProjectAddress",
  "bundleData": {
    "files": [
      {
        "name": "ro-crate-metadata.json",
        "content": "...",
        "type": "application/json"
      }
    ],
    "metadata": {
      "project_path": "../al-engine/project-files/0x1234...",
      "created_at": "2025-07-28T12:34:56.789Z"
    }
  }
}
```

### List Projects
```bash
GET http://localhost:3001/projects
```

### Check Project Exists
```bash
GET http://localhost:3001/projects/0x1234...ProjectAddress
```

### Remove Project
```bash
DELETE http://localhost:3001/projects/0x1234...ProjectAddress
```

## CLI Usage

The service also provides command-line utilities:

```bash
# Start server (default)
node local-rocrate-saver.js
node local-rocrate-saver.js server

# List saved projects
node local-rocrate-saver.js list

# Remove a project
node local-rocrate-saver.js remove 0x1234...ProjectAddress
```

## Usage in DVRE

### 1. Start the Backend Service
Before deploying projects, make sure the backend service is running:

```bash
cd al-engine
node local-rocrate-saver.js
```

### 2. Deploy Project
In JupyterLab:
1. Go to **Project Deployment**
2. Select an Active Learning project
3. Click **Deploy**

You'll see output like:
```
✅ AL Smart Contracts: Deployed
✅ IPFS Upload: Success
🔗 RO-Crate Hash: QmXXX...
✅ Local RO-Crate Save: Success
📂 Local Path: ../al-engine/project-files/0x1234...
```

### 3. Verify Files Saved

Check the project files:
```bash
cd al-engine
node local-rocrate-saver.js list
```

Or manually check:
```bash
ls -la project-files/
```

## Integration with AL-Engine

The AL-Engine can now access project files directly:

```python
# In AL-Engine
import json
import os

def load_project_config(project_id):
    """Load project configuration from local files"""
    config_path = f"./project-files/{project_id}/config/config.json"
    
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    else:
        print(f"Project {project_id} not found locally")
        return None

def get_al_config(project_id):
    """Get Active Learning configuration"""
    inputs_path = f"./project-files/{project_id}/inputs/inputs.json"
    
    if os.path.exists(inputs_path):
        with open(inputs_path, 'r') as f:
            return json.load(f)
    else:
        return None
```

## Fallback Behavior

If the backend service is not running:
- The deployment will still succeed (IPFS upload continues)
- Local save step will show "Failed" but won't block deployment
- Console will show "Backend service not available, simulating save operation"
- AL-Engine won't have local access to files (would need IPFS retrieval)

## Troubleshooting

### Service Won't Start
```bash
# Check if port 3001 is already in use
lsof -i :3001

# Kill existing process
kill -9 <PID>

# Try starting again
node local-rocrate-saver.js
```

### Permission Errors
```bash
# Make sure the script is executable
chmod +x local-rocrate-saver.js

# Check directory permissions
ls -la project-files/
```

### CORS Errors
The service includes CORS headers for development. If you encounter CORS issues:
- Make sure you're accessing from `localhost`
- Check browser console for specific error messages

## Development Notes

- The service uses Node.js built-in modules (no external dependencies)
- Files are saved as UTF-8 text (suitable for JSON/CWL/metadata)
- Binary files would need special handling (not implemented yet)
- The service creates directories recursively as needed
- Project manifest includes file listing and metadata for easy discovery

## Next Steps

1. **Start the backend service**: `node local-rocrate-saver.js`
2. **Deploy an AL project** in DVRE to test the functionality
3. **Verify files are saved** using `node local-rocrate-saver.js list`
4. **Update AL-Engine** to read from the local project files 