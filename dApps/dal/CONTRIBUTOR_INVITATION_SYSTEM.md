# Contributor Invitation & Management System for DAL Workflows

## Overview
The DAL (Decentralized Active Learning) extension now includes a comprehensive contributor invitation and management system that allows project coordinators to invite contributors, track invitation status, and manage collaborative Active Learning workflows.

## Architecture Integration

### Frontend Components
- **ContributorManager**: Main component for invitation and contributor management
- **CWLWorkflowEditor**: Integrated with contributor management
- **OrchestrationAPI**: Enhanced with contributor-related endpoints

### Backend Integration
- **Multi-User Authentication**: User role validation and permissions
- **Session Management**: Multi-user session tracking and statistics
- **Sample Assignment**: Assign samples to specific contributors
- **Label Submission**: Track contributor label submissions and consensus

## Features Implemented

### ✅ **1. Contributor Invitation Interface**

#### **For Coordinators:**
- **Invite Contributors**: Send invitations via email or wallet address
- **Invitation Status**: Track pending, accepted, declined, and expired invitations
- **Custom Messages**: Include personalized invitation messages
- **Multiple Invitation Methods**: Support both email and wallet-based invitations

#### **Invitation Modal:**
```typescript
interface Invitation {
  id: string;
  projectId: string;
  contributorWallet?: string;
  contributorEmail?: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
  message?: string;
}
```

### ✅ **2. Contributor Management Dashboard**

#### **Contributor Status Tracking:**
- **Invited**: Invitation sent, waiting for response
- **Accepted**: Invitation accepted, user ready to contribute
- **Active**: Currently participating in Active Learning sessions
- **Inactive**: Previously active but currently not participating

#### **Performance Metrics:**
```typescript
interface Contributor {
  wallet: string;
  name?: string;
  email?: string;
  status: 'invited' | 'accepted' | 'active' | 'inactive';
  samplesAssigned: number;
  labelsSubmitted: number;
  accuracyScore: number;
  lastActivity?: string;
}
```

### ✅ **3. Integration with Orchestration Server**

#### **API Endpoints:**
- `GET /al-engine/session-stats/{project_id}`: Get contributor statistics
- `POST /contributors/invite`: Send contributor invitations (planned)
- `POST /contributors/remove`: Remove contributors from project (planned)
- `POST /al-engine/assign-samples`: Assign samples to contributors
- `POST /al-engine/submit-labels`: Submit labels from contributors

#### **Role-Based Access Control:**
```python
ROLE_PERMISSIONS = {
    'coordinator': [
        'submit_workflow',
        'start_querying', 
        'manage_users',
        'assign_samples',
        'view_all_data'
    ],
    'contributor': [
        'submit_labels',
        'view_project_data',
        'participate_in_querying',
        'view_assigned_samples'
    ]
}
```

## User Workflows

### **1. Coordinator Workflow: Setting Up Collaborative AL**

1. **Create Project**: Use Project Collaboration to create Active Learning project
2. **Configure Workflow**: Open DAL extension and configure CWL workflow
3. **Invite Contributors**: 
   - Click "Invite Contributor" button
   - Enter email address or wallet address
   - Add personalized message
   - Send invitation
4. **Manage Contributors**: 
   - View invitation status
   - Track contributor performance
   - Remove inactive contributors
5. **Deploy Workflow**: Deploy with contributor list integrated

### **2. Contributor Workflow: Joining and Participating**

1. **Receive Invitation**: Get invitation via email or notification
2. **Accept Invitation**: Connect wallet and accept project invitation
3. **Access Project**: View project in DAL extension as contributor
4. **Participate in AL**: 
   - Receive sample assignments
   - Submit labels for assigned samples
   - View progress and consensus status
5. **Track Performance**: Monitor contribution metrics

### **3. Active Learning Session with Multiple Contributors**

1. **Session Initiation**: Coordinator starts querying session
2. **Sample Assignment**: 
   ```typescript
   // Coordinator assigns samples to contributors
   const assignments = [
     { contributor_wallet: '0x...', sample_ids: ['sample_1', 'sample_2'] },
     { contributor_wallet: '0x...', sample_ids: ['sample_3', 'sample_4'] }
   ];
   ```
3. **Label Submission**: Contributors submit labels for assigned samples
4. **Consensus Tracking**: System tracks label agreement and consensus
5. **Training Trigger**: When consensus reached, trigger model training
6. **Next Iteration**: Repeat for next Active Learning round

## Technical Implementation

### **Frontend Architecture**

#### **ContributorManager Component:**
```typescript
export const ContributorManager: React.FC<ContributorManagerProps> = ({
  projectId,
  userWallet,
  userRole,
  projectData,
  onContributorsChange
}) => {
  // State management for contributors and invitations
  // Invitation modal and form handling
  // Integration with orchestration API
  // Real-time contributor statistics
}
```

#### **Integration with CWL Editor:**
- Embedded in left panel of workflow editor
- Automatic contributor list updates in AL configuration
- Role-based visibility (coordinators only)
- Real-time performance metrics

### **Backend Integration**

#### **Multi-User Session Management:**
```python
class MultiUserSession:
    def __init__(self, project_id: str, coordinator_wallet: str):
        self.contributors = {}  # wallet -> contributor_data
        self.active_samples = {}  # sample_id -> assigned_wallet
        self.submitted_labels = {}  # sample_id -> {wallet: label_data}
        
    def assign_samples_to_contributor(self, contributor_wallet: str, sample_ids: List[str]):
        # Assign specific samples to contributor
        
    def submit_labels(self, contributor_wallet: str, labeled_samples: List[dict]) -> dict:
        # Handle label submission and check consensus
```

## Security & Privacy Considerations

### **Authentication & Authorization**
- **Wallet-Based Authentication**: All operations require wallet signature
- **Role-Based Permissions**: Coordinators vs. contributors have different access levels
- **Project-Level Isolation**: Contributors only see their assigned project data

### **Data Privacy**
- **Sample Assignment**: Contributors only see assigned samples
- **Label Isolation**: Contributors can't see other's label submissions
- **Consensus Protection**: Individual votes protected until consensus reached

### **Invitation Security**
- **Expiration**: Invitations expire after 7 days
- **Wallet Verification**: Recipients must prove wallet ownership
- **Project Validation**: Invitations tied to specific project contracts

## Current Status & Future Enhancements

### ✅ **Implemented (Phase 1)**
- [x] Contributor invitation interface
- [x] Invitation status tracking
- [x] Contributor performance metrics
- [x] Integration with CWL workflow editor
- [x] Role-based access control
- [x] Multi-user session framework

### 🔄 **In Progress (Phase 2)**
- [ ] Server-side invitation endpoints
- [ ] Email notification system
- [ ] Real-time invitation status updates
- [ ] Enhanced consensus algorithms

### 🚀 **Planned (Phase 3)**
- [ ] Advanced sample assignment strategies
- [ ] Contributor reputation scoring
- [ ] Conflict resolution mechanisms
- [ ] Performance-based incentives
- [ ] Cross-project contributor recommendations

## Usage Examples

### **Inviting Contributors (Coordinator)**
```typescript
// Open DAL extension as coordinator
// Navigate to CWL workflow editor
// In the left panel, find "Project Contributors" section
// Click "Invite Contributor"
// Fill out invitation form:
//   - Email: researcher@university.edu
//   - Wallet: 0x742d35Cc6Ff678d1b2Bfa32...
//   - Message: "Join our medical imaging AL project"
// Click "Send Invitation"
```

### **Managing Active Session (Coordinator)**
```typescript
// Start Active Learning session
const sessionResponse = await orchestrationAPI.startQuerying(
  projectId, workflowId, { query_count: 20 }
);

// Assign samples to contributors
const assignments = [
  { 
    contributor_wallet: '0x123...', 
    sample_ids: sessionResponse.queried_samples.slice(0, 10).map(s => s.sample_id)
  },
  { 
    contributor_wallet: '0x456...', 
    sample_ids: sessionResponse.queried_samples.slice(10, 20).map(s => s.sample_id)
  }
];

await orchestrationAPI.assignSamples(projectId, sessionResponse.session_id, assignments);
```

### **Submitting Labels (Contributor)**
```typescript
// Contributor receives assigned samples
// Labels samples through DAL interface
const labeledSamples = [
  { sample_id: 'sample_1', label: 'positive', confidence: 0.8 },
  { sample_id: 'sample_2', label: 'negative', confidence: 0.9 }
];

await orchestrationAPI.submitLabels(projectId, sessionId, labeledSamples);
```

This contributor invitation and management system transforms individual Active Learning workflows into truly collaborative, multi-user research environments while maintaining security, privacy, and proper access controls through the DVRE blockchain infrastructure. 