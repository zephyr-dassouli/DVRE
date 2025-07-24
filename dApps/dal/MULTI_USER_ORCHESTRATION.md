# Multi-User Orchestration Requirements for DVRE DAL

## Overview
This document outlines the requirements for implementing multi-user support in the DVRE orchestration server to handle Active Learning workflows with proper user authentication and role-based access control.

## User Authentication & Role Management

### 1. User Identification
- **Primary Key**: Ethereum wallet address (0x...)
- **Source**: MetaMask connection from DVRE frontend
- **Validation**: Every request must include `user_wallet` field

### 2. Role Hierarchy
Based on DVRE smart contract project data:

#### **Coordinator** (Project Owner)
- **Who**: Project creator (from smart contract)
- **Permissions**:
  - Deploy/modify CWL workflows
  - Start/stop Active Learning sessions
  - Manage project settings
  - Access all project data
  - Invite/remove contributors

#### **Contributor** (Project Member)
- **Who**: Users in project participants list
- **Permissions**:
  - Submit labels for queried samples
  - View project progress
  - Execute assigned tasks
  - Cannot modify core workflows

#### **Observer** (Read-only)
- **Who**: Any authenticated user not in project
- **Permissions**:
  - View public project metadata only
  - Cannot execute any operations

## Required Server-Side Changes

### 1. User Authentication Middleware
```python
def authenticate_user(request):
    """Validate user wallet and determine role"""
    user_wallet = request.json.get('user_wallet')
    contract_address = request.json.get('contract_address')
    
    # Validate wallet signature (optional but recommended)
    # Query smart contract for user role
    role = get_user_role_from_contract(user_wallet, contract_address)
    
    return {
        'user_wallet': user_wallet,
        'role': role,
        'project_address': contract_address
    }
```

### 2. Role-Based Access Control
```python
ROLE_PERMISSIONS = {
    'coordinator': [
        'submit_workflow',
        'start_querying', 
        'modify_project',
        'view_all_data',
        'manage_users'
    ],
    'contributor': [
        'submit_labels',
        'view_project_data',
        'participate_in_querying'
    ],
    'observer': [
        'view_public_metadata'
    ]
}

def check_permission(user_role, required_permission):
    return required_permission in ROLE_PERMISSIONS.get(user_role, [])
```

### 3. Enhanced API Endpoints

#### Workflow Submission (Phase 1)
```
POST /streamflow/submit-project-workflow
{
  "project_id": "0x...",
  "cwl_workflow": {...},
  "user_wallet": "0x...",
  "user_role": "coordinator",
  "contract_address": "0x...",
  ...
}
```

#### AL Commands (Phase 2)
```
POST /al-engine/command
{
  "command_type": "start_querying",
  "project_id": "0x...",
  "user_wallet": "0x...",
  "user_role": "coordinator",
  "contract_address": "0x...",
  ...
}
```

### 4. Data Isolation & Access Control
- **Project Workflows**: Only accessible to project members
- **Session Data**: Role-based visibility
- **Sample Labels**: Contributors can only see their own submissions
- **Audit Trail**: Track all user actions with timestamps

### 5. Multi-User Session Management
```python
class QueryingSession:
    def __init__(self, project_id, coordinator_wallet):
        self.project_id = project_id
        self.coordinator = coordinator_wallet
        self.contributors = []
        self.active_samples = {}
        self.submitted_labels = {}
        
    def assign_samples_to_contributor(self, contributor_wallet, samples):
        """Assign specific samples to specific contributors"""
        
    def submit_labels(self, contributor_wallet, labeled_samples):
        """Handle label submission with contributor tracking"""
        
    def check_consensus(self):
        """Check if enough labels received for consensus"""
```

## Implementation Priority

### Phase 1: Basic User Authentication ✅ (Implemented in Frontend)
- [x] User wallet identification
- [x] Role determination from DVRE project data
- [x] Authenticated API calls

### Phase 2: Server-Side Role Management (TODO)
- [ ] User authentication middleware
- [ ] Role-based endpoint access control
- [ ] Project data isolation

### Phase 3: Multi-User Workflows (TODO)
- [ ] Collaborative labeling sessions
- [ ] Sample assignment to contributors
- [ ] Consensus mechanisms
- [ ] Real-time session updates

### Phase 4: Advanced Features (TODO)
- [ ] User activity audit trails
- [ ] Performance metrics per contributor
- [ ] Conflict resolution for label disagreements
- [ ] Dynamic role changes

## Security Considerations

### 1. Wallet Verification
- Optional: Implement signature verification for user requests
- Prevent wallet spoofing attacks
- Session management with expiry

### 2. Smart Contract Integration
- Verify user roles directly from blockchain
- Cache role data with periodic refresh
- Handle blockchain network issues gracefully

### 3. Data Privacy
- Contributors only see assigned samples
- Project data isolation between different projects
- Secure handling of IPFS hashes and model data

## Example Workflow

### 1. Project Creation (via DVRE)
1. User creates AL project in Project Collaboration
2. Smart contract stores creator as coordinator
3. Project becomes available in DAL extension

### 2. Workflow Configuration
1. Coordinator opens DAL extension
2. Configures CWL workflow with user authentication
3. Server validates coordinator role before accepting

### 3. Active Learning Session
1. Coordinator starts querying session
2. Server assigns samples to available contributors
3. Contributors submit labels through their DAL interface
4. Server aggregates labels and triggers training
5. Process repeats until completion

## Testing Strategy

### 1. Multi-User Simulation
- Create test projects with multiple wallet addresses
- Simulate coordinator and contributor interactions
- Test role-based access restrictions

### 2. Concurrent Session Testing
- Multiple users active in same project
- Concurrent label submission
- Race condition handling

### 3. Security Testing
- Attempt unauthorized access
- Role escalation attempts
- Data isolation verification

This multi-user orchestration system will enable truly decentralized Active Learning where multiple researchers can collaborate on the same project with appropriate access controls and data privacy. 