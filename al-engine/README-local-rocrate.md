# Local RO-Crate Saver Service

This service saves RO-Crate bundles locally to the `al-engine/ro-crates` directory for the AL-Engine to access.

## How it works

1. **IPFS Upload**: RO-Crate is uploaded to IPFS for decentralized access ✅ (existing)
2. **Local Save**: The same RO-Crate is saved locally to `al-engine/ro-crates` (new feature)

## File Structure

```
al-engine/
├── ro-crates/                     ← RO-Crate bundles
│   └── 0x1234.../                 ← Project ID (contract address)
│       ├── config/
│       │   └── config.json        ← AL configuration
│       ├── inputs/
│       │   └── inputs.json        ← Dataset information
│       ├── metadata/
│       │   └── ro-crate-metadata.json ← RO-Crate JSON-LD
│       └── project-manifest.json  ← Project metadata
└── local-rocrate-saver.js         ← This service
```

## Complete Workflow

1. User deploys project in JupyterLab ✅
2. RO-Crate is uploaded to IPFS ✅ (existing)
3. Smart contracts are updated ✅ (existing)
4. RO-Crate is saved locally to al-engine/ro-crates ✅ (NEW)
5. Deployment completes ✅
6. AL-Engine can access files directly from ro-crates/

## File Structure Example

```
al-engine/ro-crates/
└── 0x1234567890abcdef/
    ├── config/
    │   └── config.json
    ├── inputs/
    │   └── inputs.json
    ├── metadata/
    │   └── ro-crate-metadata.json
    └── project-manifest.json
```

## Starting the Service

```bash
cd al-engine
node local-rocrate-saver.js
```

Expected output:
```
🚀 Local RO-Crate Saver running on http://localhost:3001
📂 Project files directory: /path/to/al-engine/ro-crates
Available endpoints:
  POST /save-rocrate - Save RO-Crate bundle
  GET /projects - List all projects
  GET /projects/:id - Check if project exists
  DELETE /projects/:id - Remove project
```

## API Endpoints

### POST /save-rocrate
Save RO-Crate bundle with all files.

**Request Body:**
```json
{
  "projectId": "0x1234...",
  "files": [
    {
      "path": "config/config.json",
      "content": "{...}",
      "size": 1234
    }
  ],
  "metadata": {
    "ipfsHash": "QmXXX...",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "project_id": "0x1234...",
  "project_path": "../al-engine/ro-crates/0x1234...",
  "saved_files": [
    "config/config.json",
    "inputs/inputs.json",
    "metadata/ro-crate-metadata.json"
  ],
  "total_files": 3,
  "total_size": 15234
}
```

### GET /projects
List all saved projects.

### GET /projects/:id
Check if a specific project exists.

### DELETE /projects/:id
Remove a project directory.

## CLI Usage

From `al-engine/` directory:

```bash
# List all projects
ls -la ro-crates/

# Access a specific project
cd ro-crates/0x1234567890abcdef

# View AL configuration
cat config/config.json

# View dataset information
cat inputs/inputs.json

# Run AL iteration (example)
cd ../..  # Back to al-engine root
python main.py --project-id 0x1234567890abcdef --config-path ./ro-crates/0x1234567890abcdef/config/config.json

# Or use relative path in your scripts:
config_path = f"./ro-crates/{project_id}/config/config.json"
```

```python
# Example AL-Engine usage:
config_path = f"./ro-crates/{project_id}/config/config.json"
dataset_path = f"./ro-crates/{project_id}/inputs/inputs.json"

# Load configuration
with open(config_path, 'r') as f:
    config = json.load(f)
    
# Load dataset information  
with open(inputs_path, 'r') as f:
    inputs = json.load(f)
```

## Integration with DVRE

1. **LocalROCrateService.ts** (Frontend) prepares the RO-Crate data
2. **local-rocrate-saver.js** (Backend) receives HTTP POST and writes files
3. **AL-Engine** accesses files directly from `ro-crates/`

## File Permissions

The service creates files with standard permissions. Make sure the AL-Engine has read access to the `ro-crates/` directory.

## Troubleshooting

### Service not starting
- Check if port 3001 is available
- Ensure Node.js is installed
- Check file permissions in `al-engine/` directory

### Files not saving
- Verify the service is running on port 3001
- Check browser developer console for CORS errors
- Ensure `ro-crates/` directory exists

### AL-Engine can't access files
- Check file paths in your AL scripts
- Verify `ro-crates/` directory exists
- Ensure proper file permissions

### Testing the service
```bash
# Test if service is running
curl http://localhost:3001/projects

# Check specific project
curl http://localhost:3001/projects/0x1234567890abcdef
```

## Directory listing example:
```bash
ls -la ro-crates/
# drwxr-xr-x  3 user  staff   96 Jan  1 12:00 0x1234567890abcdef
# drwxr-xr-x  3 user  staff   96 Jan  1 12:01 0x9876543210fedcba
``` 