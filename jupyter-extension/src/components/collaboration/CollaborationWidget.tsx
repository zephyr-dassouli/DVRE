import { ReactWidget } from '@jupyterlab/ui-components';
import React from 'react';
import CollaborationComponent from './CollaborationComponent';

export class CollaborationWidget extends ReactWidget {
  private _title: string;

  constructor(title: string = 'Project Collaboration') {
    super();
    this._title = title;
    this.addClass('dvre-widget');
    this.title.label = title;
    this.title.closable = true;
  }

  render(): JSX.Element {
    return <CollaborationComponent title={this._title} />;
  }
}

export default CollaborationWidget;