# DVRE Integration Plan: Centralized RO-Crate Management

## 🎯 **Objective**
Move RO-Crate management from individual dApps to DVRE core, enabling standardized metadata management across all project types while allowing dApps to contribute domain-specific metadata.

---

## 🏗️ **DVRE Core Changes Required**

### **1. RO-Crate Service (`packages/core/src/services/ROCrateService.ts`)**

```typescript
export interface DVREROCrate {
  metadata: ROCrateMetadata;
  project: BaseProjectMetadata;
  datasets: Record<string, ROCrateDataset>;
  workflows: Record<string, ROCrateWorkflow>;
  models: Record<string, ROCrateModel>;
  outputs: Record<string, any>;
  // dApp-specific extensions
  extensions: Record<string, any>; // e.g., { dal: ALConfiguration, bio: BioConfig }
  ipfs?: {
    roCrateHash?: string;
    bundleHash?: string;
    urls?: Record<string, string>;
  };
}

export class DVREROCrateService {
  /**
   * Create RO-Crate for new project
   */
  async createProjectROCrate(
    projectId: string,
    projectData: any,
    coordinatorWallet: string
  ): Promise<DVREROCrate>

  /**
   * Get RO-Crate for project
   */
  async getProjectROCrate(projectId: string): Promise<DVREROCrate | null>

  /**
   * Update RO-Crate with dApp-specific data
   */
  async updateROCrateExtension(
    projectId: string,
    dAppName: string,
    extensionData: any
  ): Promise<DVREROCrate>

  /**
   * Finalize and upload to IPFS
   */
  async finalizeROCrate(
    projectId: string,
    contractAddress: string
  ): Promise<{ ipfsHash: string; bundleHash: string }>
}
```

### **2. Project API Extensions (`packages/core/src/api/projects.ts`)**

```typescript
// Add new endpoints to existing project API
export const projectAPIExtensions = {
  // GET /api/projects/:id/rocrate
  getROCrate: async (projectId: string) => {
    return roCrateService.getProjectROCrate(projectId);
  },

  // POST /api/projects/:id/rocrate/extensions/:dappName
  updateROCrateExtension: async (projectId: string, dAppName: string, data: any) => {
    return roCrateService.updateROCrateExtension(projectId, dAppName, data);
  },

  // POST /api/projects/:id/finalize
  finalizeProject: async (projectId: string, contractAddress: string) => {
    return roCrateService.finalizeROCrate(projectId, contractAddress);
  }
};
```

### **3. Storage Integration (`packages/core/src/storage/`)**

```typescript
// LocalStorage for development, can be extended to other backends
export class ROCrateStorageManager {
  async store(projectId: string, roCrate: DVREROCrate): Promise<void>
  async retrieve(projectId: string): Promise<DVREROCrate | null>
  async delete(projectId: string): Promise<void>
  async list(): Promise<string[]>
}

// IPFS integration for finalization
export class DVREIPFSManager extends IPFSManager {
  async uploadProjectROCrate(
    projectId: string,
    roCrate: DVREROCrate
  ): Promise<IPFSUploadResult>
}
```

### **4. Event System (`packages/core/src/events/`)**

```typescript
export interface ROCrateEvents {
  'rocrate:created': { projectId: string; roCrate: DVREROCrate };
  'rocrate:updated': { projectId: string; dApp: string; extension: any };
  'rocrate:finalized': { projectId: string; ipfsHash: string };
}

// Allow dApps to listen for RO-Crate changes
export const roCrateEventEmitter = new EventEmitter<ROCrateEvents>();
```

---

## 🔧 **DAL dApp Changes Required**

### **1. Remove Local RO-Crate Management**

```typescript
// REMOVE: src/ROCrateManager.ts (move to DVRE core)
// REMOVE: Local storage management in ProjectSetupWizard
// REMOVE: Direct IPFS upload logic
```

### **2. Create DVRE RO-Crate Integration (`src/DVREROCrateClient.ts`)**

```typescript
export class DVREROCrateClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch project RO-Crate from DVRE
   */
  async getProjectROCrate(projectId: string): Promise<DVREROCrate | null> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/rocrate`);
    if (!response.ok) return null;
    return response.json();
  }

  /**
   * Update RO-Crate with DAL-specific configuration
   */
  async updateDALConfiguration(
    projectId: string,
    alConfig: ALConfiguration,
    workflow?: any,
    datasets?: any[]
  ): Promise<DVREROCrate> {
    const dalExtension = {
      alConfig,
      workflow,
      datasets,
      type: 'active_learning',
      version: '1.0'
    };

    const response = await fetch(
      `${this.baseUrl}/projects/${projectId}/rocrate/extensions/dal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dalExtension)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update DAL configuration: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Trigger project finalization through DVRE
   */
  async finalizeProject(projectId: string, contractAddress: string): Promise<{
    ipfsHash: string;
    bundleHash: string;
  }> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractAddress })
    });

    if (!response.ok) {
      throw new Error(`Project finalization failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Listen for RO-Crate updates
   */
  onROCrateUpdate(
    projectId: string,
    callback: (roCrate: DVREROCrate) => void
  ): () => void {
    // WebSocket or EventSource implementation for real-time updates
    const eventSource = new EventSource(`${this.baseUrl}/projects/${projectId}/rocrate/stream`);
    
    eventSource.onmessage = (event) => {
      const roCrate = JSON.parse(event.data);
      callback(roCrate);
    };

    return () => eventSource.close();
  }
}

export const dvreROCrateClient = new DVREROCrateClient();
```

### **3. Update ProjectSetupWizard (`src/ProjectSetupWizard.tsx`)**

```typescript
export const ProjectSetupWizard: React.FC<ProjectSetupWizardProps> = ({
  projectId,
  projectData,
  userWallet,
  onComplete,
  onCancel
}) => {
  const [roCrate, setROCrate] = useState<DVREROCrate | null>(null);
  
  // Load RO-Crate from DVRE instead of creating locally
  useEffect(() => {
    loadROCrateFromDVRE();
  }, [projectId]);

  const loadROCrateFromDVRE = async () => {
    try {
      const existingROCrate = await dvreROCrateClient.getProjectROCrate(projectId);
      if (existingROCrate) {
        setROCrate(existingROCrate);
        // Load existing DAL configuration
        if (existingROCrate.extensions?.dal) {
          setAlConfig(existingROCrate.extensions.dal.alConfig);
        }
      }
    } catch (error) {
      console.error('Failed to load RO-Crate from DVRE:', error);
    }
  };

  // Update DVRE's RO-Crate instead of local storage
  const updateDALConfiguration = async () => {
    try {
      const updatedROCrate = await dvreROCrateClient.updateDALConfiguration(
        projectId,
        alConfig,
        cwlWorkflow,
        [trainingDataset, labelingDataset].filter(Boolean)
      );
      setROCrate(updatedROCrate);
    } catch (error) {
      console.error('Failed to update DAL configuration:', error);
      setError(error.message);
    }
  };

  // Finalize through DVRE instead of direct IPFS upload
  const finalizeProject = async () => {
    try {
      setLoading(true);
      
      // Update configuration one final time
      await updateDALConfiguration();
      
      // Trigger DVRE finalization
      const result = await dvreROCrateClient.finalizeProject(
        projectId,
        projectData.address
      );
      
      console.log('Project finalized:', result);
      onComplete(result);
      
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Rest of component logic...
};
```

### **4. Update DALComponent Integration (`src/DALComponent.tsx`)**

```typescript
export const DALComponent: React.FC<DALComponentProps> = () => {
  // Use DVRE RO-Crate client instead of local management
  const [roCrates, setROCrates] = useState<Record<string, DVREROCrate>>({});

  const loadActiveLearningProjects = useCallback(async () => {
    const projects = await useActiveLearningProjects();
    
    // Load RO-Crates for each project
    const roCratePromises = projects.map(async (project) => {
      const roCrate = await dvreROCrateClient.getProjectROCrate(project.id);
      return { projectId: project.id, roCrate };
    });
    
    const results = await Promise.all(roCratePromises);
    const roCrateMap = results.reduce((acc, { projectId, roCrate }) => {
      if (roCrate) acc[projectId] = roCrate;
      return acc;
    }, {} as Record<string, DVREROCrate>);
    
    setROCrates(roCrateMap);
  }, []);

  // Subscribe to RO-Crate updates
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    
    Object.keys(roCrates).forEach(projectId => {
      const unsubscribe = dvreROCrateClient.onROCrateUpdate(projectId, (updatedROCrate) => {
        setROCrates(prev => ({
          ...prev,
          [projectId]: updatedROCrate
        }));
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [Object.keys(roCrates)]);
};
```

---

## 📋 **Implementation Checklist**

### **DVRE Core (Priority 1)**
- [ ] Create `ROCrateService` in DVRE core
- [ ] Add RO-Crate API endpoints to project routes
- [ ] Implement storage layer (localStorage + IPFS)
- [ ] Add event system for real-time updates
- [ ] Create project creation hooks to generate RO-Crates
- [ ] Add finalization endpoint with IPFS upload

### **DAL dApp (Priority 2)**
- [ ] Create `DVREROCrateClient` for API communication
- [ ] Remove local `ROCrateManager` 
- [ ] Update `ProjectSetupWizard` to use DVRE APIs
- [ ] Update `DALComponent` to fetch RO-Crates from DVRE
- [ ] Add real-time update subscriptions
- [ ] Update finalization flow to use DVRE endpoint

### **Integration (Priority 3)**
- [ ] Test end-to-end flow
- [ ] Add error handling and fallbacks
- [ ] Performance optimization
- [ ] Documentation updates

---

## 🎯 **Benefits of This Approach**

### **✅ Standardization**
- Consistent RO-Crate structure across all dApps
- Shared metadata standards and validation
- Unified IPFS upload and storage strategy

### **✅ Reusability**
- Other dApps can easily add their own extensions
- Common RO-Crate operations available to all dApps
- Shared infrastructure reduces duplication

### **✅ Maintainability**
- Single source of truth for project metadata
- Centralized IPFS and blockchain integration
- Easier to update standards and add features

### **✅ User Experience**
- Real-time collaboration across dApps
- Consistent project state regardless of which dApp is used
- Better performance through optimized caching

This architectural change will create a much more robust and scalable system where DVRE acts as the central metadata hub and dApps contribute their domain-specific enhancements! 