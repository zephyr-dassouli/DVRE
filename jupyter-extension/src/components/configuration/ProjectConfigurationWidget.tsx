import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { ProjectConfigurationComponent } from './ProjectConfigurationComponent';
import { DVREProjectConfiguration } from '../../services/ProjectConfigurationService';

/**
 * Project Configuration Widget for DVRE
 * Simple wrapper that integrates with JupyterLab's widget system
 */
export class ProjectConfigurationWidget extends ReactWidget {
  private _title: string;
  private _projectId?: string;

  constructor(title: string = 'Project Configuration', projectId?: string) {
    super();
    this._title = title;
    this._projectId = projectId;
    this.addClass('dvre-widget');
    this.addClass('dvre-project-configuration-widget');
    this.title.label = title;
    this.title.iconClass = 'jp-SettingsIcon';
    this.title.closable = true;
  }

  render(): JSX.Element {
    return (
      <ProjectConfigurationComponent 
        title={this._title}
        projectId={this._projectId}
        onConfigurationChange={(config: DVREProjectConfiguration) => {
          // Update widget title with project name if available
          if (config.projectData?.name) {
            this.title.label = `Configuration: ${config.projectData.name}`;
          }
        }}
      />
    );
  }

  /**
   * Set the project ID and refresh the widget
   */
  setProjectId(projectId: string): void {
    this._projectId = projectId;
    this.update();
  }
}

export default ProjectConfigurationWidget; 