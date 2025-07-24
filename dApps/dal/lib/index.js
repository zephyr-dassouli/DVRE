import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
import { ILauncher } from '@jupyterlab/launcher';
import { LabIcon } from '@jupyterlab/ui-components';
import { DALWidget } from './DALWidget';
// Import CSS
import '../style/index.css';
const dalIcon = new LabIcon({
    name: 'dvre-dal:icon',
    svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v8M4 8h8" stroke="currentColor" stroke-width="1.5"/><path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" stroke-width="1" opacity="0.7"/></svg>'
});
const plugin = {
    id: 'jupyter-dvre-dal:plugin',
    description: 'Decentralized Active Learning extension for DVRE',
    autoStart: true,
    requires: [ICommandPalette],
    optional: [ILauncher],
    activate: (app, palette, launcher) => {
        console.log('DVRE DAL extension is activated!');
        // NOTE: DVRE core registration removed due to TypeScript compatibility issues
        // The extension works standalone and will be discovered by DVRE core if available
        // Command for DAL
        const dalCommand = 'dvre-dal:open';
        app.commands.addCommand(dalCommand, {
            label: 'Active Learning',
            caption: 'Open Decentralized Active Learning interface',
            icon: dalIcon,
            execute: () => {
                const content = new DALWidget('Decentralized Active Learning');
                const widget = new MainAreaWidget({ content });
                widget.id = `dvre-dal-${Date.now()}`;
                widget.title.closable = true;
                widget.title.icon = dalIcon;
                app.shell.add(widget, 'main');
                app.shell.activateById(widget.id);
            }
        });
        // Add to command palette
        palette.addItem({ command: dalCommand, category: 'DVRE' });
        // Add to launcher if available
        if (launcher) {
            launcher.add({
                command: dalCommand,
                category: 'DVRE',
                rank: 10
            });
            console.log('DAL extension added to launcher successfully!');
        }
        else {
            console.log('Launcher not available - DAL extension only in command palette');
        }
    }
};
export default plugin;
//# sourceMappingURL=index.js.map