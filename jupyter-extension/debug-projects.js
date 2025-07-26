// Debug script to identify missing Active Learning projects
// Run this in the browser console while on the DVRE application

console.log('🔍 DVRE Project Debug Script');
console.log('==============================');

// 1. Check Local Storage for project configurations
console.log('\n1. 📦 Checking Local Storage:');
const localStorageKeys = Object.keys(localStorage);
const dvreKeys = localStorageKeys.filter(key => key.includes('dvre') || key.includes('project'));
console.log('DVRE-related keys:', dvreKeys);

dvreKeys.forEach(key => {
  const value = localStorage.getItem(key);
  console.log(`${key}:`, value ? JSON.parse(value) : 'null');
});

// 2. Check if userProjects are loaded
console.log('\n2. 🔗 Checking Blockchain Projects:');
if (window.dvreDebugData) {
  console.log('User projects from blockchain:', window.dvreDebugData.userProjects);
} else {
  console.log('⚠️ No debug data available. Make sure you\'re on the DVRE app.');
}

// 3. Check wallet connection
console.log('\n3. 💰 Checking Wallet Connection:');
if (window.ethereum) {
  window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
    console.log('Connected accounts:', accounts);
  });
} else {
  console.log('❌ No MetaMask detected');
}

// 4. Check for project templates
console.log('\n4. 📋 Checking Project Templates:');
if (window.dvreDebugData && window.dvreDebugData.templates) {
  console.log('Available templates:', window.dvreDebugData.templates);
  const alTemplate = window.dvreDebugData.templates.find(t => 
    t.projectType === 'active_learning' || t.name.toLowerCase().includes('active learning')
  );
  console.log('Active Learning template:', alTemplate);
} else {
  console.log('⚠️ No template data available');
}

// 5. Check project configurations
console.log('\n5. ⚙️ Checking Project Configurations:');
const projectConfigKeys = localStorageKeys.filter(key => key.includes('dvre-project-config'));
projectConfigKeys.forEach(key => {
  const config = JSON.parse(localStorage.getItem(key) || '{}');
  console.log(`Config ${key}:`, {
    projectId: config.projectId,
    status: config.status,
    projectType: config.projectData?.type || config.projectData?.project_type || config.projectData?.templateType,
    hasDALExtension: !!config.extensions?.dal,
    created: config.created
  });
});

console.log('\n✅ Debug complete! Check the output above for issues.');
console.log('💡 Common issues:');
console.log('   - No wallet connected');
console.log('   - Projects not loaded from blockchain');
console.log('   - Local storage cleared');
console.log('   - Template detection not working'); 