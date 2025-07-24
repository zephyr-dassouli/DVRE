import { jsx as _jsx } from "react/jsx-runtime";
import { ReactWidget } from '@jupyterlab/ui-components';
import DALComponent from './DALComponent';
export class DALWidget extends ReactWidget {
    constructor(title = 'Decentralized Active Learning') {
        super();
        this._title = title;
        this.addClass('dvre-widget');
        this.addClass('dvre-dal-widget');
        this.title.label = title;
        this.title.closable = true;
    }
    render() {
        return _jsx(DALComponent, { title: this._title });
    }
}
//# sourceMappingURL=DALWidget.js.map