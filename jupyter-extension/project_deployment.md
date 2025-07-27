# Project Deployment Holistic View

## User Authentication and Project Creation

### Initial Setup
- **User authenticates** → ✅ implemented
- In **Project Collaboration**, user creates a new project which deploys its smart contract

### Project Template Deployment
- If a project template was chosen (e.g., Active Learning), the project smart contract `JSONProject` will be deployed by `ProjectFactory` using `ProjectTemplateRegistry`
- Template comes with pre-filled parameters such as:
  - Type
  - Roles  
  - Policies
- **Status**: ✅ implemented

### User Invitations and Requests
- **Project owner** can invite others to join the project by sending invitations which they need to accept
  - **Status**: ❌ not implemented yet
- **Other users** may send join requests, which need to be approved by the project owner
  - **Status**: ✅ implemented

## Project Deployment (Main Focus) - TO BE IMPLEMENTED

User configures the project further and deploys it. **All components in this section need to be implemented.**

### Active Learning Project Configuration

Specific for Active Learning projects (and maybe federated learning, but no need to implement that for now).

#### Project Configuration Panel - ⚠️ TO BE IMPLEMENTED

Contains the following fields that need to be implemented:

- **Query Strategy**: e.g., uncertainty sampling (we will use the ones in modAL for our prototype)
- **AL Scenario**: pool-based, stream-based
- **Max Iteration**: e.g., 5 (can also be infinite → meaning until samples run out or the coordinator stops the project)
- **Query Batch Size**: e.g., 2 → how many samples for labeling per AL iteration
- **Voting Consensus**: e.g., simple majority
- **Training Dataset**: choose from menu (needs to be stored on IPFS first via IPFS Manager)
- **Labeling Dataset**: choose from menu (needs to be stored on IPFS first via IPFS Manager)
- **Model**: choose from menu
  - Either uploaded by user to IPFS via IPFS Manager
  - Or any default model from modAL hardcoded (they come with user's DAL jupyter extension)
- **Label Space**: possible labels for the samples for the project

#### Workflows Panel - ⚠️ TO BE IMPLEMENTED

- **Needs to be implemented**: Panel for viewing the CWL workflow file
- For Active Learning projects, it should be preconfigured and predefined and hardcoded (since we are prototyping)
- User doesn't need to define themselves
- Displaying it to the user is enough

#### Users List Display - ⚠️ TO BE IMPLEMENTED

**This entire section needs to be implemented:**

- Shows owner + collaborators with their roles
- For Active Learning projects: coordinator, contributor
- Show pending/approved invitations
- Show pending join requests

### Non-Template Projects

For other projects not using a template → user needs to build it on UI (future work)

## ROCrate Structure

ROCrate should contain these 3 or 4 files:

```
ro-crate-dal-project/
├── ro-crate-metadata.json
├── workflows/
│   └── al_iteration.cwl
├── inputs/
│   └── inputs.json
├── config/
│   └── config.json
```

## Deployment Process - ⚠️ TO BE IMPLEMENTED

**The entire deployment flow needs to be implemented.** When user clicks **Deploy**:

1. **Smart Contract Updates**:
   - The Main Project Smart Contract (`JSONProject`) gets updated
   - The 2 helper contracts `ALProjectVoting` and `ALProjectStorage` get created and linked to the main project contract

2. **Configuration File Creation**:
   - A `config.json` file that goes inside the ROCrate gets created based on the smart contract data (the ones the user just updated)

3. **IPFS Storage**:
   - System sends ROCrate to IPFS

4. **Workflow Assignment**:
   - Workflow CWL files get sent to orchestrator
   - Orchestrator assigns the workflow to the right executor
   - In case of Active Learning, it is the coordinator's ALEngine

5. **Final Updates**:
   - ROCrate hash and workflow ID (or hash) are put on project smart contract

## Implementation Requirements Summary

### Already Implemented ✅
- User authentication
- Project template deployment via `ProjectFactory` and `ProjectTemplateRegistry`
- Join requests handling

### NOT Implemented - Requires Development ❌
- User invitation system

### **MAIN IMPLEMENTATION TARGET - Project Deployment Section** ⚠️

**All of the following components need to be fully implemented:**

1. **Project Configuration Panel**
   - All configuration fields (query strategy, AL scenario, max iterations, etc.)
   - Form validation and data handling
   - Integration with smart contracts

2. **Workflows Panel**
   - CWL workflow file display
   - Pre-configured workflow handling for Active Learning

3. **Users List Display**
   - Owner and collaborator display with roles
   - Invitation status management
   - Join request handling UI

4. **Complete Deployment Process**
   - the Main Project Smart Contract (JSONProject) gets updated.
   - the 2 helper ALProjectVoting and ALProjectStorage get created and linked to the main project contract.
   - a config.json file that goes inside the RO-Crate, gets created based on the smart contract data (the ones the user just updated)
   - system uploads RO-Crate to IPFS and generates its root CID
   - system sends the cwl workflow file (in case of Active Learning it is al_iteration.cwl) to the orchestrator, orchestrator assigns the workflow to the right executor (in case of Active Learning it is the coordinator’s AL-Engine)
   - RO-Crate IPFS CID is put onto project smart contract