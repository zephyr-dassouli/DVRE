# DVRE-DAL Integration Testing Guide

## 🎯 **Overview**

This guide provides step-by-step instructions for testing the complete integration between DVRE core RO-Crate system and the DAL (Decentralized Active Learning) dApp.

---

## 🧪 **Phase 1: Core RO-Crate Testing**

### **Prerequisites**
- DVRE JupyterLab running (http://localhost:8888)
- DVRE core extension loaded with RO-Crate services
- Browser Developer Tools open (F12)

### **Step 1: Test DVRE RO-Crate Foundation**

1. **Open JupyterLab** and go to the Console tab in DevTools
2. **Run basic RO-Crate tests:**
   ```javascript
   // Copy and paste the test_rocrate.js script and run
   await testROCrateIntegration();
   ```
3. **Expected Result:** All 8 RO-Crate tests should pass
4. **If tests fail:** Check console errors and ensure DVRE core is properly loaded

---

## 🔗 **Phase 2: Integration Testing**

### **Step 2: Test DVRE-DAL Integration**

1. **Run integration tests:**
   ```javascript
   // Copy and paste the test_dal_integration.js script and run
   await testDALIntegration();
   ```

2. **Expected Results:** All 6 integration tests should pass:
   - ✅ Project RO-Crate Creation
   - ✅ DAL Extension Integration  
   - ✅ Multi-dApp Coexistence
   - ✅ Project Finalization Flow
   - ✅ Real-time Updates
   - ✅ Data Export and Metadata

---

## 📱 **Phase 3: DAL dApp User Interface Testing**

### **Step 3: Install Updated DAL Extension**

1. **Build DAL extension:**
   ```bash
   cd dApps/dal
   npm run build
   ```

2. **Install in JupyterLab:**
   ```bash
   jupyter labextension install .
   # or if already installed:
   jupyter labextension develop . --overwrite
   ```

3. **Restart JupyterLab** to load the updated extension

### **Step 4: Test DAL dApp UI**

1. **Open DAL dApp** from the launcher or command palette
2. **Connect Wallet** (if not already connected)
3. **Verify Project Discovery:**
   - DAL should find AL projects from DVRE
   - Projects should show with "Setup Project" button

4. **Test Project Setup Wizard:**
   - Click "Setup Project" on any AL project
   - Configure Active Learning settings:
     - Query Strategy (uncertainty_sampling, diversity_sampling, hybrid)
     - Labeling Budget (e.g., 100-500)
     - Max Iterations (e.g., 5-20)
   - Save configuration and proceed to review
   - Finalize project

5. **Verify Integration:**
   - Check console for successful DVRE API calls
   - Verify RO-Crate updates in real-time
   - Test project finalization with mock IPFS upload

---

## 🔍 **Phase 4: End-to-End Workflow Testing**

### **Step 5: Complete Workflow Test**

1. **Create New AL Project:**
   - Use Project Collaboration to create an "Active Learning" project
   - Add project description and participants

2. **Configure in DAL:**
   - Open DAL dApp
   - Find the new project in the list
   - Use Setup Wizard to configure AL parameters
   - Save and finalize configuration

3. **Verify Persistence:**
   - Refresh the page
   - Verify DAL configuration persists
   - Check RO-Crate data is properly stored

4. **Test Collaboration:**
   - Add contributors to the project
   - Verify they can see the AL configuration
   - Test real-time updates between users

---

## ✅ **Expected Behaviors**

### **Successful Integration Indicators:**

1. **DVRE Core:**
   - ✅ RO-Crate services globally available (`window.roCrateService`, `window.roCrateAPI`)
   - ✅ Projects automatically get base RO-Crate when created
   - ✅ Extensions can be added/updated seamlessly

2. **DAL Integration:**
   - ✅ DAL finds projects from DVRE project list
   - ✅ Setup wizard connects to DVRE RO-Crate APIs
   - ✅ Configuration saves to DVRE extensions
   - ✅ Finalization uses DVRE IPFS upload

3. **User Experience:**
   - ✅ Smooth workflow from Project Collaboration → DAL setup
   - ✅ Real-time updates across dApps
   - ✅ Consistent data persistence
   - ✅ Error handling with user-friendly messages

---

## 🐛 **Troubleshooting**

### **Common Issues:**

1. **"DVRE RO-Crate API not found"**
   - Ensure DVRE core extension is loaded
   - Check `window.roCrateAPI` exists in console
   - Restart JupyterLab if needed

2. **"DAL RO-Crate not found"**
   - Create an AL project first using Project Collaboration
   - Ensure project type is "active_learning"
   - Check project exists in DVRE project list

3. **Extension Not Loading:**
   - Run `npm run build` in DAL directory
   - Check for TypeScript compilation errors
   - Restart JupyterLab after installation

4. **Configuration Not Saving:**
   - Check browser console for API errors
   - Verify wallet connection is active
   - Ensure project permissions allow updates

---

## 📊 **Test Scenarios**

### **Scenario 1: New User Workflow**
1. New user opens DVRE
2. Creates first AL project via Project Collaboration
3. Opens DAL dApp
4. Configures project using Setup Wizard
5. Finalizes project for execution

### **Scenario 2: Multi-User Collaboration**
1. Coordinator creates AL project
2. Invites contributors
3. Each user opens DAL dApp
4. Contributors see project configuration
5. Real-time updates when coordinator changes settings

### **Scenario 3: Multi-dApp Usage**
1. User has projects with multiple dApp types
2. Creates AL project (DAL) and bio project (future bio dApp)
3. Each dApp only shows relevant projects
4. RO-Crates contain extensions for each dApp
5. No conflicts between dApp configurations

---

## 🎯 **Success Criteria**

### **Integration Complete When:**

- [ ] All RO-Crate tests pass (8/8)
- [ ] All integration tests pass (6/6)
- [ ] DAL dApp builds without errors
- [ ] Setup wizard saves configuration to DVRE
- [ ] Project finalization uploads to IPFS (mock)
- [ ] Real-time updates work between dApps
- [ ] Multi-user collaboration functions
- [ ] Error handling is graceful and informative

### **Ready for Production When:**
- [ ] Replace mock IPFS with real IPFS service
- [ ] Add server-side DVRE API endpoints
- [ ] Implement smart contract IPFS hash storage
- [ ] Add cross-project discovery features
- [ ] Complete contributor invitation system

---

## 🚀 **Next Steps After Testing**

Once integration tests pass:

1. **Replace Mock Components:**
   - Implement real IPFS integration
   - Add proper smart contract integration
   - Create server-side API endpoints

2. **Enhance Features:**
   - Add dataset upload functionality
   - Implement workflow execution
   - Add real-time collaboration features

3. **Scale to Other dApps:**
   - Use same pattern for bio-informatics dApp
   - Add federated learning dApp
   - Create dApp template for easy development

---

**🎉 The integration testing should demonstrate that DVRE now provides a solid, centralized foundation for multiple dApps to share project metadata and collaborate seamlessly!** 