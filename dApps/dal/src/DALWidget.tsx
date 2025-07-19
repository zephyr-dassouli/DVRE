import { ReactWidget } from '@jupyterlab/ui-components';
import React from 'react';
import DALComponent from './DALComponent';

export class DALWidget extends ReactWidget {
  private _title: string;

  constructor(title: string = 'Decentralized Active Learning') {
    super();
    this._title = title;
    this.addClass('dvre-widget');
    this.addClass('dvre-dal-widget');
    this.title.label = title;
    this.title.closable = true;
  }

  render(): JSX.Element {
    return <DALComponent title={this._title} />;
  }
} 