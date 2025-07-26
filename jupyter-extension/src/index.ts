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
import { AuthWidget, CollaborationWidget, GraphWidget, FederatedLearningWidget, IPFSWidget } from './components';
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
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="3" r="2" fill="currentColor"/><circle cx="13" cy="3" r="2" fill="currentColor"/><circle cx="3" cy="13" r="2" fill="currentColor"/><circle cx="13" cy="13" r="2" fill="currentColor"/><circle cx="8" cy="8" r="2" fill="currentColor"/><line x1="5" y1="3" x2="11" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="5" x2="3" y2="11" stroke="currentColor" stroke-width="1.5"/><line x1="13" y1="5" x2="13" y2="11" stroke="currentColor" stroke-width="1.5"/><line x1="5" y1="13" x2="11" y2="13" stroke="currentColor" stroke-width="1.5"/><line x1="5" y1="5" x2="6.5" y2="6.5" stroke="currentColor" stroke-width="1.5"/><line x1="11" y1="5" x2="9.5" y2="6.5" stroke="currentColor" stroke-width="1.5"/><line x1="5" y1="11" x2="6.5" y2="9.5" stroke="currentColor" stroke-width="1.5"/><line x1="11" y1="11" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="1.5"/></svg>'
});

const federatedLearningIcon = new LabIcon({
  name: 'my-extension:federated-learning',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="8" r="2" fill="currentColor"/><circle cx="8" cy="3" r="2" fill="currentColor"/><circle cx="13" cy="8" r="2" fill="currentColor"/><circle cx="8" cy="13" r="2" fill="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><path d="M5.5 7L6.5 8.5M10.5 7L9.5 8.5M8.5 5.5L8.5 6.5M8.5 9.5L8.5 10.5" stroke="currentColor" stroke-width="1" fill="none"/><path d="M6 8h4M8 6v4" stroke="currentColor" stroke-width="0.5" opacity="0.6"/></svg>'
});

const ipfsIcon = new LabIcon({
  name: 'my-extension:ipfs',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="4" r="1.5" fill="currentColor"/><circle cx="4" cy="10" r="1.5" fill="currentColor"/><circle cx="12" cy="10" r="1.5" fill="currentColor"/><path d="M8 5.5L6.5 9.5M8 5.5L9.5 9.5M6.5 9.5L9.5 9.5" stroke="currentColor" stroke-width="1" fill="none"/></svg>'
});

const userRegistryIcon = new LabIcon({
  name: 'my-extension:user-registry',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8zm-7.978-1A.261.261 0 0 1 7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.274.274 0 0 1-.014.002H7.022zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6.936 9.28a5.88 5.88 0 0 0-1.23-.247A7.35 7.35 0 0 0 5 9c-4 0-5 3-5 4 0 .667.333 1 1 1h4.216A2.238 2.238 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816zM4.92 10A5.493 5.493 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275zM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>'
});

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'my-extension',
  description: 'My awesome JupyterLab extension',
  autoStart: true,
  requires: [ICommandPalette],
  optional: [ILauncher],
  activate: (
    app: JupyterFrontEnd, 
    palette: ICommandPalette, 
    launcher: ILauncher | null
  ) => {
    console.log('D-VRE is activated!');

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

    // Add to command palette
    palette.addItem({ command: authCommand, category: 'D-VRE' });
    palette.addItem({ command: collaborationCommand, category: 'D-VRE' });
    palette.addItem({ command: graphCommand, category: 'D-VRE' });
    palette.addItem({ command: federatedLearningCommand, category: 'D-VRE' });
    palette.addItem({ command: ipfsCommand, category: 'D-VRE' });
    palette.addItem({ command: userRegistryCommand, category: 'D-VRE' });

    if (launcher) {
      launcher.add({
        command: authCommand,
        category: 'D-VRE', 
        rank: 1
      });

      launcher.add({
        command: collaborationCommand,
        category: 'D-VRE',
        rank: 2
      });

      launcher.add({
        command: graphCommand,
        category: 'D-VRE',
        rank: 3
      });

      launcher.add({
        command: federatedLearningCommand,
        category: 'D-VRE',
        rank: 4
      });

      launcher.add({
        command: ipfsCommand,
        category: 'D-VRE',
        rank: 5
      });

      launcher.add({
        command: userRegistryCommand,
        category: 'D-VRE',
        rank: 6
      });

      console.log('Extension added to launcher successfully!');
    } else {
      console.log('Launcher not available - extension only in command palette');
    }
  }
};

export default plugin;