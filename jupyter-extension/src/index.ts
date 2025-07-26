import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { 
  ICommandPalette, 
  MainAreaWidget
} from '@jupyterlab/apputils';

import { ILauncher } from '@jupyterlab/launcher';
import { LabIcon } from '@jupyterlab/ui-components';

import { Widget } from '@lumino/widgets';
import { AuthWidget, CollaborationWidget, GraphWidget, FederatedLearningWidget, IPFSWidget, ProjectDeploymentWidget } from './components';
import { ExtensionDiscovery, IExtensionInfo } from './services/ExtensionDiscovery';
import { UserRegistryReactWidget } from './widgets/UserRegistryWidget';


// Import CSS
import '../style/index.css';

// Create icons (you can use built-in icons or create custom SVG icons)
const authIcon = new LabIcon({
  name: 'my-extension:auth',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>'
});

const collaborationIcon = new LabIcon({
  name: 'my-extension:collaboration',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"/><path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>'
});

const graphIcon = new LabIcon({
  name: 'my-extension:graph',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="3" r="2" fill="currentColor"/><circle cx="13" cy="3" r="2" fill="currentColor"/><circle cx="8" cy="13" r="2" fill="currentColor"/><path d="M5 3h6M11 5l-3 6M5 5l3 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>'
});

const federatedLearningIcon = new LabIcon({
  name: 'my-extension:federated-learning',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="4" r="1" fill="currentColor"/><circle cx="4" cy="8" r="1" fill="currentColor"/><circle cx="12" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="currentColor"/><path d="M8 5v2M6 8h2M8 10v2M10 8h2" stroke="currentColor" stroke-width="1"/></svg>'
});

const ipfsIcon = new LabIcon({
  name: 'my-extension:ipfs',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="4" r="1.5" fill="currentColor"/><circle cx="4" cy="10" r="1.5" fill="currentColor"/><circle cx="12" cy="10" r="1.5" fill="currentColor"/><path d="M8 5.5L6.5 9.5M8 5.5L9.5 9.5M6.5 9.5L9.5 9.5" stroke="currentColor" stroke-width="1" fill="none"/></svg>'
});

const deploymentIcon = new LabIcon({
  name: 'my-extension:deployment',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M8 11.5L10.5 9H9V6.5H7V9H5.5L8 11.5z" fill="currentColor"/></svg>'
});

// Dynamic icon for discovered extensions
const createExtensionIcon = (name: string) => new LabIcon({
  name: `dvre-extension:${name}`,
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v8M4 8h8" stroke="currentColor" stroke-width="1.5"/><path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" stroke-width="1" opacity="0.7"/></svg>'
});

// Extension Info Widget class
class ExtensionInfoWidget extends Widget {
  constructor(extensionInfo: IExtensionInfo) {
    super();
    this.addClass('dvre-extension-info');
    
    const div = document.createElement('div');
    div.style.padding = '20px';
    div.style.fontFamily = 'var(--jp-ui-font-family)';
    
    div.innerHTML = `
      <h2>${extensionInfo.manifest.displayName}</h2>
      <p><strong>Version:</strong> ${extensionInfo.manifest.version}</p>
      <p><strong>Category:</strong> ${extensionInfo.manifest.category || 'General'}</p>
      <p><strong>Description:</strong> ${extensionInfo.manifest.description}</p>
      <p><strong>Author:</strong> ${extensionInfo.manifest.author}</p>
      
      <h3>Capabilities</h3>
      <ul>
        ${extensionInfo.manifest.compute?.capabilities?.map(cap => `<li>${cap}</li>`).join('') || '<li>No capabilities listed</li>'}
      </ul>
      
      <h3>Permissions</h3>
      <ul>
        ${extensionInfo.manifest.permissions.map(perm => `<li>${perm}</li>`).join('')}
      </ul>
      
      <div style="margin-top: 20px; padding: 15px; background: var(--jp-warn-color3); border-radius: 4px;">
        <strong>Note:</strong> This is a placeholder. The actual extension functionality would be loaded here.
        <br><br>
        <strong>To enable full functionality:</strong> Install the separate ${extensionInfo.name} extension package.
      </div>
    `;
    
    this.node.appendChild(div);
  }
}

const userRegistryIcon = new LabIcon({
  name: 'my-extension:user-registry',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8zm-7.978-1A.261.261 0 0 1 7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.274.274 0 0 1-.014.002H7.022zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6.936 9.28a5.88 5.88 0 0 0-1.23-.247A7.35 7.35 0 0 0 5 9c-4 0-5 3-5 4 0 .667.333 1 1 1h4.216A2.238 2.238 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816zM4.92 10A5.493 5.493 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275zM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>'
});

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'my-extension',
  description: 'DVRE Core - Decentralized Virtual Research Environment',
  autoStart: true,
  requires: [ICommandPalette],
  optional: [ILauncher],
  activate: (
    app: JupyterFrontEnd, 
    palette: ICommandPalette, 
    launcher: ILauncher | null
  ) => {
    console.log('DVRE Core is activated!');

    // Initialize extension discovery
    const extensionDiscovery = new ExtensionDiscovery();
    
    // Store discovered extensions for potential integration
    let discoveredExtensions: IExtensionInfo[] = [];

    // Discover and load dApp extensions
    extensionDiscovery.discoverExtensions().then(extensions => {
      discoveredExtensions = extensions;
      console.log(`DVRE Core: Discovered ${extensions.length} dApp extension(s)`);
      
      if (extensions.length === 0) {
        console.log('DVRE Core: No external dApp extensions found. Install additional extensions like DAL for more functionality.');
      }
      
      // Register commands for discovered extensions
      extensions.forEach(ext => {
        const extensionCommand = `dvre-extension:${ext.name}`;
        const icon = createExtensionIcon(ext.name);
        
        app.commands.addCommand(extensionCommand, {
          label: ext.manifest.displayName,
          caption: ext.manifest.description,
          icon: icon,
          execute: () => {
            // Create a placeholder widget showing extension info
            // In a real implementation, this would load the actual extension component
            const content = new ExtensionInfoWidget(ext);
            const widget = new MainAreaWidget({ content });
            widget.id = `dvre-${ext.name}-${Date.now()}`;
            widget.title.closable = true;
            widget.title.icon = icon;
            
            app.shell.add(widget, 'main');
            app.shell.activateById(widget.id);
          }
        });

        // Add to command palette and launcher
        palette.addItem({ 
          command: extensionCommand, 
          category: `DVRE Extensions` 
        });
        
        if (launcher) {
          launcher.add({
            command: extensionCommand,
            category: 'DVRE Extensions',
            rank: 100 + extensions.indexOf(ext)
          });
        }

        console.log(`DVRE Core: Registered extension - ${ext.manifest.displayName} (${ext.manifest.category || 'General'})`);
      });
    }).catch(error => {
      console.warn('DVRE Core: Failed to discover extensions:', error);
    });

    // Command for authentication
    const authCommand = 'my-extension:auth';
    app.commands.addCommand(authCommand, {
      label: 'Authentication',
      caption: 'Authentication Tool',
      icon: authIcon,
      execute: () => {
        const content = new AuthWidget('Authentication');
        const widget = new MainAreaWidget({ content });
        widget.id = `my-auth-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = authIcon;
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

    // Command for collaboration
    const collaborationCommand = 'my-extension:collaboration';
    app.commands.addCommand(collaborationCommand, {
      label: 'Project Collaboration',
      caption: 'Manage and collaborate on projects',
      icon: collaborationIcon,
      execute: () => {
        const content = new CollaborationWidget('Project Collaboration');
        const widget = new MainAreaWidget({ content });
        widget.id = `my-collaboration-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = collaborationIcon;
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

    // Command for graph view
    const graphCommand = 'my-extension:graph';
    app.commands.addCommand(graphCommand, {
      label: 'Project Graph View',
      caption: 'Visualize project connections and relationships',
      icon: graphIcon,
      execute: () => {
        const content = new GraphWidget('Project Graph View');
        const widget = new MainAreaWidget({ content });
        widget.id = `my-graph-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = graphIcon;
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

    // Command for federated learning
    const federatedLearningCommand = 'my-extension:federated-learning';
    app.commands.addCommand(federatedLearningCommand, {
      label: 'Federated Learning',
      caption: 'Manage and monitor federated learning projects',
      icon: federatedLearningIcon,
      execute: () => {
        const content = new FederatedLearningWidget('Federated Learning');
        const widget = new MainAreaWidget({ content });
        widget.id = `my-federated-learning-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = federatedLearningIcon;
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

    // Command for IPFS
    const ipfsCommand = 'my-extension:ipfs';
    app.commands.addCommand(ipfsCommand, {
      label: 'IPFS Manager',
      caption: 'Manage files on IPFS and blockchain assets',
      icon: ipfsIcon,
      execute: () => {
        const content = new IPFSWidget('IPFS Manager');
        const widget = new MainAreaWidget({ content });
        widget.id = `my-ipfs-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = ipfsIcon;
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });
    // Command for project deployment (UPDATED from configuration)
    const deploymentCommand = 'my-extension:deployment';
    app.commands.addCommand(deploymentCommand, {
      label: 'Project Deployment',
      caption: 'Deploy projects with RO-Crate and orchestration server integration',
      icon: deploymentIcon,
      execute: () => {
        const content = new ProjectDeploymentWidget({
          title: 'Project Deployment'
        });
        const widget = new MainAreaWidget({ content });
        widget.id = `my-deployment-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = deploymentIcon;
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });
        
         // Command for User Registry
    const userRegistryCommand = 'my-extension:user-registry';
    app.commands.addCommand(userRegistryCommand, {
      label: 'User Registry',
      caption: 'View all D-VRE users and their metadata',
      icon: userRegistryIcon,
      execute: () => {
        const content = new UserRegistryReactWidget();
        const widget = new MainAreaWidget({ content });
        widget.id = `my-user-registry-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = userRegistryIcon;
        widget.title.label = 'User Registry';
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

    // Add core commands to command palette
    palette.addItem({ command: authCommand, category: 'DVRE Core' });
    palette.addItem({ command: collaborationCommand, category: 'DVRE Core' });
    palette.addItem({ command: graphCommand, category: 'DVRE Core' });
    palette.addItem({ command: federatedLearningCommand, category: 'DVRE Core' });
    palette.addItem({ command: ipfsCommand, category: 'DVRE Core' });
    palette.addItem({ command: deploymentCommand, category: 'DVRE Core' });
     palette.addItem({ command: userRegistryCommand, category: 'D-VRE Core' });


    // Add core commands to launcher
    if (launcher) {
      launcher.add({
        command: authCommand,
        category: 'DVRE Core', 
        rank: 1
      });

      launcher.add({
        command: collaborationCommand,
        category: 'DVRE Core',
        rank: 2
      });

      launcher.add({
        command: graphCommand,
        category: 'DVRE Core',
        rank: 3
      });

      launcher.add({
        command: federatedLearningCommand,
        category: 'DVRE Core',
        rank: 4
      });

      launcher.add({
        command: ipfsCommand,
        category: 'DVRE Core',
        rank: 5
      });

      launcher.add({
        command: deploymentCommand,
        category: 'DVRE Core',
        rank: 6
      });
     
      launcher.add({
        command: userRegistryCommand,
        category: 'DVRE Core',
        rank: 7
      });

      console.log('DVRE Core: Extension added to launcher successfully!');
      
    } else {
      console.log('DVRE Core: Launcher not available - extension only in command palette');
    }

    // Add extension registry to the application for other extensions to use
    const extensionRegistry = {
      getDiscoveredExtensions: () => discoveredExtensions,
      refreshExtensions: () => extensionDiscovery.discoverExtensions()
    };

    // Store in app context for other extensions to access
    (app as any)._dvre_extension_registry = extensionRegistry;
  }
};

export default plugin;