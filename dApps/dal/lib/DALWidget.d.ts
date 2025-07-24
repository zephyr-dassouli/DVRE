import { ReactWidget } from '@jupyterlab/ui-components';
export declare class DALWidget extends ReactWidget {
    private _title;
    constructor(title?: string);
    render(): JSX.Element;
}
