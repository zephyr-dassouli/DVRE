"use strict";
(self["webpackChunkjupyter_dvre_dal"] = self["webpackChunkjupyter_dvre_dal"] || []).push([["style_index_css"],{

/***/ "./node_modules/css-loader/dist/cjs.js!./style/index.css":
/*!***************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./style/index.css ***!
  \***************************************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/sourceMaps.js */ "./node_modules/css-loader/dist/runtime/sourceMaps.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/* DVRE DAL Extension Styles */

.dvre-widget {
  font-family: var(--jp-ui-font-family);
  background: var(--jp-layout-color1);
  color: var(--jp-ui-font-color1);
  height: 100%;
  overflow: hidden;
}

.dvre-dal-widget {
  padding: 0;
}

/* DAL Component Styles */
.dal-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  height: 100vh;
  overflow-y: auto;
}

.dal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px;
  background: var(--jp-layout-color2);
  border-radius: 8px;
  border: 1px solid var(--jp-border-color1);
}

.dal-header h1 {
  margin: 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.8rem;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 15px;
}

.status-indicator, .server-status {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-indicator.connected {
  background: var(--jp-success-color3);
  color: var(--jp-success-color0);
}

.status-indicator.disconnected {
  background: var(--jp-error-color3);
  color: var(--jp-error-color0);
}

.server-status.healthy {
  background: var(--jp-success-color3);
  color: var(--jp-success-color0);
}

.server-status.unhealthy {
  background: var(--jp-warn-color3);
  color: var(--jp-warn-color0);
}

.connect-button {
  background: var(--jp-brand-color1);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.connect-button:hover {
  background: var(--jp-brand-color2);
}

.connect-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.account-info {
  font-size: 0.8rem;
  color: var(--jp-ui-font-color2);
  background: var(--jp-layout-color3);
  padding: 4px 8px;
  border-radius: 4px;
}

/* Error and Loading */
.error-message {
  background: var(--jp-error-color3);
  color: var(--jp-error-color0);
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-message button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.2rem;
}

.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  color: var(--jp-ui-font-color2);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--jp-layout-color3);
  border-top: 2px solid var(--jp-brand-color1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Projects Section */
.projects-section {
  margin-bottom: 40px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  margin: 0;
  color: var(--jp-ui-font-color0);
}

.refresh-button {
  background: var(--jp-layout-color3);
  border: 1px solid var(--jp-border-color1);
  color: var(--jp-ui-font-color1);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.refresh-button:hover {
  background: var(--jp-layout-color2);
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--jp-ui-font-color2);
  background: var(--jp-layout-color2);
  border-radius: 8px;
  border: 2px dashed var(--jp-border-color2);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.project-card {
  background: var(--jp-layout-color1);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  padding: 20px;
  transition: all 0.2s ease;
}

.project-card:hover {
  border-color: var(--jp-brand-color1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.project-header h3 {
  margin: 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.1rem;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.active {
  background: var(--jp-success-color3);
  color: var(--jp-success-color0);
}

.status-badge.training {
  background: var(--jp-warn-color3);
  color: var(--jp-warn-color0);
}

.status-badge.completed {
  background: var(--jp-info-color3);
  color: var(--jp-info-color0);
}

.project-details {
  margin-bottom: 15px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.detail-row span:first-child {
  color: var(--jp-ui-font-color2);
  font-weight: 500;
}

.detail-row code {
  background: var(--jp-layout-color3);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.8rem;
}

.cwl-status {
  font-size: 0.8rem;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--jp-layout-color3);
  border-radius: 3px;
  margin-bottom: 15px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--jp-brand-color1);
  transition: width 0.3s ease;
}

.project-actions {
  display: flex;
  gap: 10px;
}

.action-button {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-button.primary {
  background: var(--jp-brand-color1);
  color: white;
}

.action-button.primary:hover {
  background: var(--jp-brand-color2);
}

.action-button.secondary {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color1);
  border: 1px solid var(--jp-border-color1);
}

.action-button.secondary:hover {
  background: var(--jp-layout-color2);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Actions Section */
.actions-section {
  margin-bottom: 40px;
}

.action-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.action-card {
  background: var(--jp-layout-color1);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.action-card h3 {
  margin: 0 0 10px 0;
  color: var(--jp-ui-font-color0);
}

.action-card p {
  margin: 0 0 15px 0;
  color: var(--jp-ui-font-color2);
  font-size: 0.9rem;
}

/* Help Section */
.help-section {
  background: var(--jp-layout-color2);
  border-radius: 8px;
  padding: 20px;
}

.help-section h2 {
  margin: 0 0 20px 0;
  color: var(--jp-ui-font-color0);
}

.help-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.help-step {
  display: flex;
  align-items: flex-start;
  gap: 15px;
}

.step-number {
  width: 30px;
  height: 30px;
  background: var(--jp-brand-color1);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  flex-shrink: 0;
}

.step-content h4 {
  margin: 0 0 5px 0;
  color: var(--jp-ui-font-color0);
}

.step-content p {
  margin: 0;
  color: var(--jp-ui-font-color2);
  font-size: 0.9rem;
}

/* CWL Workflow Editor Styles */
.cwl-workflow-editor {
  padding: 20px;
  background: var(--jp-layout-color1);
  height: 100%;
  overflow-y: auto;
}

.cwl-workflow-editor.read-only {
  background: var(--jp-layout-color2);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--jp-border-color1);
}

.editor-header h2 {
  margin: 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.5rem;
}

.close-button {
  padding: 8px 16px;
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color1);
  border: 1px solid var(--jp-border-color1);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.close-button:hover {
  background: var(--jp-layout-color2);
}

.editor-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: calc(100vh - 200px);
}

.left-panel, .right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

/* Auto-save Indicator */
.autosave-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 4px;
}

.autosave-indicator.saving {
  background: var(--jp-warn-color3);
  color: var(--jp-warn-color0);
}

.autosave-indicator.saved {
  background: var(--jp-success-color3);
  color: var(--jp-success-color0);
}

.dot-animation {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* AL Configuration Panel */
.al-config-panel {
  background: var(--jp-layout-color2);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  padding: 20px;
}

.al-config-panel h3 {
  margin: 0 0 15px 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.2rem;
  border-bottom: 1px solid var(--jp-border-color2);
  padding-bottom: 8px;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.config-group.full-width {
  grid-column: 1 / -1;
}

.config-group label {
  font-weight: 500;
  color: var(--jp-ui-font-color1);
  font-size: 13px;
}

.config-group input,
.config-group select,
.config-group textarea {
  padding: 8px;
  border: 1px solid var(--jp-border-color1);
  border-radius: 4px;
  background: var(--jp-layout-color0);
  color: var(--jp-ui-font-color1);
  font-family: var(--jp-ui-font-family);
  font-size: 13px;
}

.config-group input:focus,
.config-group select:focus,
.config-group textarea:focus {
  outline: none;
  border-color: var(--jp-brand-color1);
  box-shadow: 0 0 0 2px var(--jp-brand-color3);
}

.config-group input:disabled,
.config-group select:disabled,
.config-group textarea:disabled {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color3);
  cursor: not-allowed;
}

.config-group textarea {
  min-height: 120px;
  resize: vertical;
  font-family: var(--jp-code-font-family);
}

/* CWL Code Editor */
.cwl-code-editor {
  background: var(--jp-layout-color2);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  padding: 20px;
  flex: 1;
}

.cwl-code-editor h3 {
  margin: 0 0 15px 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.2rem;
  border-bottom: 1px solid var(--jp-border-color2);
  padding-bottom: 8px;
}

.editor-container {
  position: relative;
}

.editor-container.invalid {
  border: 2px solid var(--jp-error-color1);
  border-radius: 4px;
}

.cwl-textarea {
  width: 100%;
  min-height: 400px;
  padding: 15px;
  border: 1px solid var(--jp-border-color1);
  border-radius: 4px;
  background: var(--jp-layout-color0);
  color: var(--jp-ui-font-color1);
  font-family: var(--jp-code-font-family);
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
}

.cwl-textarea:focus {
  outline: none;
  border-color: var(--jp-brand-color1);
  box-shadow: 0 0 0 2px var(--jp-brand-color3);
}

.cwl-textarea:disabled {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color3);
  cursor: not-allowed;
}

.validation-error {
  background: var(--jp-error-color3);
  color: var(--jp-error-color1);
  padding: 8px;
  border-radius: 4px;
  margin-top: 8px;
  font-size: 12px;
}

/* Validation Panel */
.validation-panel {
  background: var(--jp-layout-color2);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  padding: 20px;
}

.validation-panel h3 {
  margin: 0 0 15px 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.2rem;
  border-bottom: 1px solid var(--jp-border-color2);
  padding-bottom: 8px;
}

.validation-status.valid {
  color: var(--jp-success-color1);
}

.validation-status.invalid {
  color: var(--jp-error-color1);
}

.validation-success {
  background: var(--jp-success-color3);
  color: var(--jp-success-color1);
  padding: 10px;
  border-radius: 4px;
  border: 1px solid var(--jp-success-color2);
}

.validation-errors,
.validation-warnings {
  margin-top: 10px;
}

.validation-errors h4,
.validation-warnings h4 {
  margin: 0 0 8px 0;
  color: var(--jp-error-color1);
}

.validation-warnings h4 {
  color: var(--jp-warn-color1);
}

.validation-errors ul,
.validation-warnings ul {
  margin: 0;
  padding-left: 20px;
  color: var(--jp-ui-font-color2);
}

/* Deployment Panel */
.deployment-panel {
  background: var(--jp-layout-color2);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  padding: 20px;
}

.deployment-panel h3 {
  margin: 0 0 15px 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.2rem;
  border-bottom: 1px solid var(--jp-border-color2);
  padding-bottom: 8px;
}

.deployment-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.draft {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color2);
}

.status-badge.deployed {
  background: var(--jp-success-color3);
  color: var(--jp-success-color1);
}

.status-badge.failed {
  background: var(--jp-error-color3);
  color: var(--jp-error-color1);
}

.workflow-id {
  font-family: var(--jp-code-font-family);
  font-size: 12px;
  color: var(--jp-ui-font-color2);
}

.workflow-id code {
  background: var(--jp-layout-color0);
  padding: 2px 4px;
  border-radius: 2px;
  border: 1px solid var(--jp-border-color2);
}

.deployment-error {
  background: var(--jp-error-color3);
  color: var(--jp-error-color1);
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 12px;
  border: 1px solid var(--jp-error-color2);
}

.deploy-button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 10px;
  width: 100%;
}

.deploy-button.ready {
  background: var(--jp-brand-color1);
  color: white;
}

.deploy-button.disabled {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color3);
  cursor: not-allowed;
}

.deploy-button:hover:not(:disabled) {
  opacity: 0.9;
}

.deployment-info {
  font-size: 12px;
  color: var(--jp-ui-font-color2);
  text-align: center;
}

/* Responsive Design */
@media (max-width: 768px) {
  .dal-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .connection-status {
    flex-wrap: wrap;
  }
  
  .projects-grid {
    grid-template-columns: 1fr;
  }
  
  .action-cards {
    grid-template-columns: 1fr;
  }
  
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .editor-content {
    flex-direction: column;
  }
  
  .left-panel {
    border-right: none;
    border-bottom: 1px solid var(--jp-border-color1);
    max-width: none;
  }
}

/* Dark mode adjustments */
[data-jp-theme-light="false"] .project-card:hover {
  box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
}

/* Runtime Orchestration Panel Styles */
.runtime-orchestration-panel {
  height: 100vh;
  background: var(--jp-layout-color1);
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: var(--jp-layout-color2);
  border-bottom: 1px solid var(--jp-border-color1);
}

.panel-header h2 {
  margin: 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.3rem;
}

.header-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 0.8rem;
  color: var(--jp-ui-font-color2);
}

.panel-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-section, .right-section {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.left-section {
  border-right: 1px solid var(--jp-border-color1);
  background: var(--jp-layout-color2);
  max-width: 500px;
}

/* Sessions Section */
.sessions-section {
  margin-bottom: 30px;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.session-item {
  background: var(--jp-layout-color1);
  border: 1px solid var(--jp-border-color1);
  border-radius: 6px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.session-item:hover {
  border-color: var(--jp-brand-color1);
}

.session-item.selected {
  border-color: var(--jp-brand-color1);
  background: var(--jp-brand-color3);
}

.session-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-title {
  font-weight: 500;
  color: var(--jp-ui-font-color0);
  font-size: 0.9rem;
}

.session-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
}

.session-meta .status {
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
}

.session-meta .status.active {
  background: var(--jp-success-color3);
  color: var(--jp-success-color0);
}

.session-meta .status.waiting_for_labels {
  background: var(--jp-warn-color3);
  color: var(--jp-warn-color0);
}

.session-meta .status.training {
  background: var(--jp-info-color3);
  color: var(--jp-info-color0);
}

.session-meta .status.completed {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color1);
}

.accuracy {
  font-size: 0.8rem;
  color: var(--jp-ui-font-color2);
}

/* Command Log Section */
.command-log-section {
  margin-top: 20px;
}

.command-log {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--jp-border-color1);
  border-radius: 4px;
  background: var(--jp-layout-color1);
}

.log-entry {
  padding: 10px;
  border-bottom: 1px solid var(--jp-border-color2);
  font-size: 0.8rem;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry.accepted {
  border-left: 3px solid var(--jp-success-color1);
}

.log-entry.completed {
  border-left: 3px solid var(--jp-success-color1);
  background: var(--jp-success-color3);
}

.log-entry.failed {
  border-left: 3px solid var(--jp-error-color1);
  background: var(--jp-error-color3);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.command-id {
  font-family: var(--jp-code-font-family);
  background: var(--jp-layout-color3);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.7rem;
}

.timestamp {
  color: var(--jp-ui-font-color2);
  font-size: 0.7rem;
}

.log-header .status {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 0.6rem;
  font-weight: 500;
  text-transform: uppercase;
}

.log-header .status.accepted {
  background: var(--jp-success-color3);
  color: var(--jp-success-color0);
}

.log-header .status.completed {
  background: var(--jp-success-color3);
  color: var(--jp-success-color0);
}

.log-header .status.failed {
  background: var(--jp-error-color3);
  color: var(--jp-error-color0);
}

.log-message {
  color: var(--jp-ui-font-color1);
}

/* Session Controls */
.session-controls {
  background: var(--jp-layout-color1);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  padding: 20px;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--jp-border-color2);
}

.session-header h4 {
  margin: 0;
  color: var(--jp-ui-font-color0);
}

.session-status {
  font-weight: 500;
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 12px;
  background: var(--jp-layout-color3);
}

.session-info {
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.info-row span:first-child {
  color: var(--jp-ui-font-color2);
  font-weight: 500;
}

.session-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.action-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-btn.primary {
  background: var(--jp-brand-color1);
  color: white;
}

.action-btn.primary:hover {
  background: var(--jp-brand-color2);
}

.action-btn.secondary {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color1);
  border: 1px solid var(--jp-border-color1);
}

.action-btn.secondary:hover {
  background: var(--jp-layout-color2);
}

.action-btn.danger {
  background: var(--jp-error-color1);
  color: white;
}

.action-btn.danger:hover {
  background: var(--jp-error-color2);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Labeling Section */
.labeling-section {
  margin-top: 15px;
  padding: 15px;
  background: var(--jp-layout-color2);
  border-radius: 6px;
  border: 1px solid var(--jp-border-color2);
}

.labeling-section h5 {
  margin: 0 0 10px 0;
  color: var(--jp-ui-font-color0);
  font-size: 0.9rem;
}

.samples-list {
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 15px;
}

.sample-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  margin-bottom: 5px;
  background: var(--jp-layout-color1);
  border-radius: 4px;
  border: 1px solid var(--jp-border-color1);
  font-size: 0.8rem;
}

.sample-id {
  font-family: var(--jp-code-font-family);
  color: var(--jp-ui-font-color0);
  font-weight: 500;
}

.sample-uncertainty {
  color: var(--jp-ui-font-color2);
}

.label-btn {
  background: var(--jp-brand-color1);
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.7rem;
}

.label-btn:hover {
  background: var(--jp-brand-color2);
}

.labeled-samples {
  margin-top: 15px;
  padding: 10px;
  background: var(--jp-success-color3);
  border-radius: 4px;
}

.labeled-samples h6 {
  margin: 0 0 8px 0;
  color: var(--jp-success-color0);
  font-size: 0.8rem;
}

.labeled-item {
  font-size: 0.7rem;
  color: var(--jp-success-color0);
  margin-bottom: 3px;
  font-family: var(--jp-code-font-family);
}

/* Danger Zone */
.danger-zone {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--jp-border-color2);
}

/* No Session Selected */
.no-session-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--jp-ui-font-color2);
}

.no-session-selected h3 {
  margin: 0 0 10px 0;
  color: var(--jp-ui-font-color1);
}

/* Phase Display */
.phase-status {
  font-size: 0.8rem;
  font-weight: 500;
}

/* Action Button Updates */
.action-button {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-button.primary {
  background: var(--jp-brand-color1);
  color: white;
}

.action-button.primary:hover {
  background: var(--jp-brand-color2);
}

.action-button.secondary {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color1);
  border: 1px solid var(--jp-border-color1);
}

.action-button.secondary:hover {
  background: var(--jp-layout-color2);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive Design for Runtime Panel */
@media (max-width: 768px) {
  .panel-content {
    flex-direction: column;
  }
  
  .left-section {
    border-right: none;
    border-bottom: 1px solid var(--jp-border-color1);
    max-width: none;
    max-height: 50vh;
  }
  
  .session-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .action-btn {
    flex: 1;
    min-width: 120px;
  }
} 

/* Contributor Manager Styles */
.contributor-manager {
  background: var(--jp-layout-color2);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.contributor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--jp-border-color2);
}

.contributor-header h3 {
  margin: 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.2rem;
}

.invite-button {
  padding: 8px 16px;
  background: var(--jp-brand-color1);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.invite-button:hover:not(:disabled) {
  background: var(--jp-brand-color2);
}

.invite-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.contributors-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.contributor-item {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 15px;
  background: var(--jp-layout-color1);
  border: 1px solid var(--jp-border-color1);
  border-radius: 6px;
  transition: border-color 0.2s ease;
}

.contributor-item:hover {
  border-color: var(--jp-brand-color1);
}

.contributor-info {
  flex: 1;
  min-width: 0;
}

.contributor-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.contributor-identity strong {
  color: var(--jp-ui-font-color0);
  font-size: 14px;
}

.contributor-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--jp-ui-font-color2);
}

.contributor-stats {
  display: flex;
  gap: 20px;
  align-items: center;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--jp-ui-font-color0);
}

.stat-label {
  font-size: 11px;
  color: var(--jp-ui-font-color2);
  text-align: center;
  margin-top: 2px;
}

.contributor-actions {
  display: flex;
  gap: 8px;
}

.remove-button {
  padding: 6px 12px;
  background: var(--jp-error-color1);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.remove-button:hover:not(:disabled) {
  background: var(--jp-error-color2);
}

.remove-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Status badges for contributors */
.status-badge.invited {
  background: var(--jp-warn-color3);
  color: var(--jp-warn-color1);
}

.status-badge.accepted {
  background: var(--jp-info-color3);
  color: var(--jp-info-color1);
}

.status-badge.active {
  background: var(--jp-success-color3);
  color: var(--jp-success-color1);
}

.status-badge.inactive {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color2);
}

/* Invitation Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--jp-layout-color1);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--jp-border-color1);
}

.modal-header h3 {
  margin: 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.3rem;
}

.modal-header .close-button {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--jp-ui-font-color2);
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-header .close-button:hover {
  color: var(--jp-ui-font-color0);
}

.modal-content {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: var(--jp-ui-font-color1);
  font-size: 13px;
}

.form-group label input[type="checkbox"] {
  margin-right: 8px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--jp-border-color1);
  border-radius: 4px;
  background: var(--jp-layout-color0);
  color: var(--jp-ui-font-color1);
  font-family: var(--jp-ui-font-family);
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--jp-brand-color1);
  box-shadow: 0 0 0 2px var(--jp-brand-color3);
}

.form-group small {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  color: var(--jp-ui-font-color2);
}

/* Review Step */
.project-summary {
  background: var(--jp-layout-color2);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.project-summary h4 {
  margin: 0 0 15px 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.1rem;
  border-bottom: 1px solid var(--jp-border-color2);
  padding-bottom: 8px;
}

.validation-result {
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.validation-result.valid {
  background: var(--jp-success-color3);
  border: 1px solid var(--jp-success-color2);
}

.validation-result.invalid {
  background: var(--jp-error-color3);
  border: 1px solid var(--jp-error-color2);
}

.validation-result h4 {
  margin: 0 0 15px 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.1rem;
}

.validation-success {
  background: var(--jp-success-color3);
  color: var(--jp-success-color1);
  padding: 15px;
  border-radius: 6px;
  border: 1px solid var(--jp-success-color2);
  font-weight: 500;
}

.validation-errors,
.validation-warnings {
  margin-top: 15px;
}

.validation-errors h5,
.validation-warnings h5 {
  margin: 0 0 10px 0;
  color: var(--jp-error-color1);
  font-size: 14px;
}

.validation-warnings h5 {
  color: var(--jp-warn-color1);
}

.validation-errors ul,
.validation-warnings ul {
  margin: 0;
  padding-left: 20px;
  color: var(--jp-ui-font-color1);
}

.validation-errors li,
.validation-warnings li {
  margin-bottom: 5px;
  font-size: 13px;
}

.rocrate-export {
  background: var(--jp-layout-color2);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.rocrate-export h4 {
  margin: 0 0 15px 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.1rem;
}

.export-button {
  padding: 10px 20px;
  background: var(--jp-brand-color1);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.export-button:hover {
  background: var(--jp-brand-color2);
}

/* Wizard Footer */
.wizard-footer {
  background: var(--jp-layout-color2);
  border-top: 1px solid var(--jp-border-color1);
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.navigation-buttons {
  display: flex;
  gap: 10px;
}

.cancel-button,
.nav-button,
.finalize-button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.cancel-button {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color1);
  border: 1px solid var(--jp-border-color1);
}

.cancel-button:hover:not(:disabled) {
  background: var(--jp-layout-color1);
}

.nav-button {
  background: var(--jp-brand-color1);
  color: white;
  min-width: 100px;
}

.nav-button:hover:not(:disabled) {
  background: var(--jp-brand-color2);
}

.nav-button.previous {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color1);
  border: 1px solid var(--jp-border-color1);
}

.nav-button.previous:hover:not(:disabled) {
  background: var(--jp-layout-color1);
}

.finalize-button {
  background: var(--jp-success-color1);
  color: white;
  min-width: 120px;
}

.finalize-button:hover:not(:disabled) {
  background: var(--jp-success-color2);
}

.cancel-button:disabled,
.nav-button:disabled,
.finalize-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive Design for Setup Wizard */
@media (max-width: 768px) {
  .config-grid,
  .summary-grid {
    grid-template-columns: 1fr;
  }
  
  .step-indicator {
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .step {
    flex: 1;
    min-width: 80px;
  }
  
  .step:not(:last-child)::after {
    display: none;
  }
  
  .wizard-content {
    padding: 20px;
  }
  
  .wizard-footer {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }
  
  .navigation-buttons {
    width: 100%;
    justify-content: space-between;
  }
  
  .nav-button,
  .finalize-button {
    flex: 1;
  }
  
  .cancel-button {
    width: 100%;
  }
} 

/* Finalization Info */
.finalization-info {
  background: var(--jp-layout-color2);
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.finalization-info h4 {
  margin: 0 0 15px 0;
  color: var(--jp-ui-font-color0);
  font-size: 1.1rem;
}

.finalization-steps {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.fin-step {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 15px;
  background: var(--jp-layout-color1);
  border-radius: 6px;
  border: 1px solid var(--jp-border-color2);
}

.step-icon {
  width: 24px;
  height: 24px;
  background: var(--jp-brand-color1);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.fin-step div {
  flex: 1;
}

.fin-step strong {
  display: block;
  color: var(--jp-ui-font-color0);
  margin-bottom: 5px;
  font-size: 14px;
}

.fin-step p {
  margin: 0;
  color: var(--jp-ui-font-color2);
  font-size: 13px;
  line-height: 1.4;
} `, "",{"version":3,"sources":["webpack://./style/index.css"],"names":[],"mappings":"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","sourcesContent":["/* DVRE DAL Extension Styles */\n\n.dvre-widget {\n  font-family: var(--jp-ui-font-family);\n  background: var(--jp-layout-color1);\n  color: var(--jp-ui-font-color1);\n  height: 100%;\n  overflow: hidden;\n}\n\n.dvre-dal-widget {\n  padding: 0;\n}\n\n/* DAL Component Styles */\n.dal-container {\n  padding: 20px;\n  max-width: 1200px;\n  margin: 0 auto;\n  height: 100vh;\n  overflow-y: auto;\n}\n\n.dal-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 30px;\n  padding: 20px;\n  background: var(--jp-layout-color2);\n  border-radius: 8px;\n  border: 1px solid var(--jp-border-color1);\n}\n\n.dal-header h1 {\n  margin: 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.8rem;\n}\n\n.connection-status {\n  display: flex;\n  align-items: center;\n  gap: 15px;\n}\n\n.status-indicator, .server-status {\n  padding: 6px 12px;\n  border-radius: 20px;\n  font-size: 0.8rem;\n  font-weight: 500;\n}\n\n.status-indicator.connected {\n  background: var(--jp-success-color3);\n  color: var(--jp-success-color0);\n}\n\n.status-indicator.disconnected {\n  background: var(--jp-error-color3);\n  color: var(--jp-error-color0);\n}\n\n.server-status.healthy {\n  background: var(--jp-success-color3);\n  color: var(--jp-success-color0);\n}\n\n.server-status.unhealthy {\n  background: var(--jp-warn-color3);\n  color: var(--jp-warn-color0);\n}\n\n.connect-button {\n  background: var(--jp-brand-color1);\n  color: white;\n  border: none;\n  padding: 8px 16px;\n  border-radius: 4px;\n  cursor: pointer;\n  font-size: 0.9rem;\n}\n\n.connect-button:hover {\n  background: var(--jp-brand-color2);\n}\n\n.connect-button:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n.account-info {\n  font-size: 0.8rem;\n  color: var(--jp-ui-font-color2);\n  background: var(--jp-layout-color3);\n  padding: 4px 8px;\n  border-radius: 4px;\n}\n\n/* Error and Loading */\n.error-message {\n  background: var(--jp-error-color3);\n  color: var(--jp-error-color0);\n  padding: 12px;\n  border-radius: 4px;\n  margin-bottom: 20px;\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n}\n\n.error-message button {\n  background: none;\n  border: none;\n  color: inherit;\n  cursor: pointer;\n  font-size: 1.2rem;\n}\n\n.loading-indicator {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 10px;\n  padding: 20px;\n  color: var(--jp-ui-font-color2);\n}\n\n.spinner {\n  width: 20px;\n  height: 20px;\n  border: 2px solid var(--jp-layout-color3);\n  border-top: 2px solid var(--jp-brand-color1);\n  border-radius: 50%;\n  animation: spin 1s linear infinite;\n}\n\n@keyframes spin {\n  0% { transform: rotate(0deg); }\n  100% { transform: rotate(360deg); }\n}\n\n/* Projects Section */\n.projects-section {\n  margin-bottom: 40px;\n}\n\n.section-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 20px;\n}\n\n.section-header h2 {\n  margin: 0;\n  color: var(--jp-ui-font-color0);\n}\n\n.refresh-button {\n  background: var(--jp-layout-color3);\n  border: 1px solid var(--jp-border-color1);\n  color: var(--jp-ui-font-color1);\n  padding: 6px 12px;\n  border-radius: 4px;\n  cursor: pointer;\n}\n\n.refresh-button:hover {\n  background: var(--jp-layout-color2);\n}\n\n.empty-state {\n  text-align: center;\n  padding: 40px;\n  color: var(--jp-ui-font-color2);\n  background: var(--jp-layout-color2);\n  border-radius: 8px;\n  border: 2px dashed var(--jp-border-color2);\n}\n\n.projects-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));\n  gap: 20px;\n}\n\n.project-card {\n  background: var(--jp-layout-color1);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  padding: 20px;\n  transition: all 0.2s ease;\n}\n\n.project-card:hover {\n  border-color: var(--jp-brand-color1);\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);\n}\n\n.project-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 15px;\n}\n\n.project-header h3 {\n  margin: 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.1rem;\n}\n\n.status-badge {\n  padding: 4px 8px;\n  border-radius: 12px;\n  font-size: 0.7rem;\n  font-weight: 500;\n  text-transform: uppercase;\n}\n\n.status-badge.active {\n  background: var(--jp-success-color3);\n  color: var(--jp-success-color0);\n}\n\n.status-badge.training {\n  background: var(--jp-warn-color3);\n  color: var(--jp-warn-color0);\n}\n\n.status-badge.completed {\n  background: var(--jp-info-color3);\n  color: var(--jp-info-color0);\n}\n\n.project-details {\n  margin-bottom: 15px;\n}\n\n.detail-row {\n  display: flex;\n  justify-content: space-between;\n  margin-bottom: 8px;\n  font-size: 0.9rem;\n}\n\n.detail-row span:first-child {\n  color: var(--jp-ui-font-color2);\n  font-weight: 500;\n}\n\n.detail-row code {\n  background: var(--jp-layout-color3);\n  padding: 2px 4px;\n  border-radius: 3px;\n  font-size: 0.8rem;\n}\n\n.cwl-status {\n  font-size: 0.8rem;\n}\n\n.progress-bar {\n  width: 100%;\n  height: 6px;\n  background: var(--jp-layout-color3);\n  border-radius: 3px;\n  margin-bottom: 15px;\n  overflow: hidden;\n}\n\n.progress-fill {\n  height: 100%;\n  background: var(--jp-brand-color1);\n  transition: width 0.3s ease;\n}\n\n.project-actions {\n  display: flex;\n  gap: 10px;\n}\n\n.action-button {\n  flex: 1;\n  padding: 8px 12px;\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n  font-size: 0.8rem;\n  font-weight: 500;\n  transition: all 0.2s ease;\n}\n\n.action-button.primary {\n  background: var(--jp-brand-color1);\n  color: white;\n}\n\n.action-button.primary:hover {\n  background: var(--jp-brand-color2);\n}\n\n.action-button.secondary {\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color1);\n  border: 1px solid var(--jp-border-color1);\n}\n\n.action-button.secondary:hover {\n  background: var(--jp-layout-color2);\n}\n\n.action-button:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n/* Actions Section */\n.actions-section {\n  margin-bottom: 40px;\n}\n\n.action-cards {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));\n  gap: 20px;\n}\n\n.action-card {\n  background: var(--jp-layout-color1);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  padding: 20px;\n  text-align: center;\n}\n\n.action-card h3 {\n  margin: 0 0 10px 0;\n  color: var(--jp-ui-font-color0);\n}\n\n.action-card p {\n  margin: 0 0 15px 0;\n  color: var(--jp-ui-font-color2);\n  font-size: 0.9rem;\n}\n\n/* Help Section */\n.help-section {\n  background: var(--jp-layout-color2);\n  border-radius: 8px;\n  padding: 20px;\n}\n\n.help-section h2 {\n  margin: 0 0 20px 0;\n  color: var(--jp-ui-font-color0);\n}\n\n.help-content {\n  display: flex;\n  flex-direction: column;\n  gap: 15px;\n}\n\n.help-step {\n  display: flex;\n  align-items: flex-start;\n  gap: 15px;\n}\n\n.step-number {\n  width: 30px;\n  height: 30px;\n  background: var(--jp-brand-color1);\n  color: white;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-weight: bold;\n  flex-shrink: 0;\n}\n\n.step-content h4 {\n  margin: 0 0 5px 0;\n  color: var(--jp-ui-font-color0);\n}\n\n.step-content p {\n  margin: 0;\n  color: var(--jp-ui-font-color2);\n  font-size: 0.9rem;\n}\n\n/* CWL Workflow Editor Styles */\n.cwl-workflow-editor {\n  padding: 20px;\n  background: var(--jp-layout-color1);\n  height: 100%;\n  overflow-y: auto;\n}\n\n.cwl-workflow-editor.read-only {\n  background: var(--jp-layout-color2);\n}\n\n.editor-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 20px;\n  padding-bottom: 15px;\n  border-bottom: 2px solid var(--jp-border-color1);\n}\n\n.editor-header h2 {\n  margin: 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.5rem;\n}\n\n.close-button {\n  padding: 8px 16px;\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color1);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 4px;\n  cursor: pointer;\n  font-size: 14px;\n}\n\n.close-button:hover {\n  background: var(--jp-layout-color2);\n}\n\n.editor-content {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 20px;\n  height: calc(100vh - 200px);\n}\n\n.left-panel, .right-panel {\n  display: flex;\n  flex-direction: column;\n  gap: 20px;\n  overflow-y: auto;\n}\n\n/* Auto-save Indicator */\n.autosave-indicator {\n  display: flex;\n  align-items: center;\n  gap: 5px;\n  font-size: 0.8rem;\n  padding: 4px 8px;\n  border-radius: 4px;\n}\n\n.autosave-indicator.saving {\n  background: var(--jp-warn-color3);\n  color: var(--jp-warn-color0);\n}\n\n.autosave-indicator.saved {\n  background: var(--jp-success-color3);\n  color: var(--jp-success-color0);\n}\n\n.dot-animation {\n  animation: pulse 1.5s ease-in-out infinite;\n}\n\n@keyframes pulse {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.5; }\n}\n\n/* AL Configuration Panel */\n.al-config-panel {\n  background: var(--jp-layout-color2);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  padding: 20px;\n}\n\n.al-config-panel h3 {\n  margin: 0 0 15px 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.2rem;\n  border-bottom: 1px solid var(--jp-border-color2);\n  padding-bottom: 8px;\n}\n\n.config-grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 15px;\n  margin-bottom: 15px;\n}\n\n.config-group {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n}\n\n.config-group.full-width {\n  grid-column: 1 / -1;\n}\n\n.config-group label {\n  font-weight: 500;\n  color: var(--jp-ui-font-color1);\n  font-size: 13px;\n}\n\n.config-group input,\n.config-group select,\n.config-group textarea {\n  padding: 8px;\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 4px;\n  background: var(--jp-layout-color0);\n  color: var(--jp-ui-font-color1);\n  font-family: var(--jp-ui-font-family);\n  font-size: 13px;\n}\n\n.config-group input:focus,\n.config-group select:focus,\n.config-group textarea:focus {\n  outline: none;\n  border-color: var(--jp-brand-color1);\n  box-shadow: 0 0 0 2px var(--jp-brand-color3);\n}\n\n.config-group input:disabled,\n.config-group select:disabled,\n.config-group textarea:disabled {\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color3);\n  cursor: not-allowed;\n}\n\n.config-group textarea {\n  min-height: 120px;\n  resize: vertical;\n  font-family: var(--jp-code-font-family);\n}\n\n/* CWL Code Editor */\n.cwl-code-editor {\n  background: var(--jp-layout-color2);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  padding: 20px;\n  flex: 1;\n}\n\n.cwl-code-editor h3 {\n  margin: 0 0 15px 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.2rem;\n  border-bottom: 1px solid var(--jp-border-color2);\n  padding-bottom: 8px;\n}\n\n.editor-container {\n  position: relative;\n}\n\n.editor-container.invalid {\n  border: 2px solid var(--jp-error-color1);\n  border-radius: 4px;\n}\n\n.cwl-textarea {\n  width: 100%;\n  min-height: 400px;\n  padding: 15px;\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 4px;\n  background: var(--jp-layout-color0);\n  color: var(--jp-ui-font-color1);\n  font-family: var(--jp-code-font-family);\n  font-size: 12px;\n  line-height: 1.4;\n  resize: vertical;\n}\n\n.cwl-textarea:focus {\n  outline: none;\n  border-color: var(--jp-brand-color1);\n  box-shadow: 0 0 0 2px var(--jp-brand-color3);\n}\n\n.cwl-textarea:disabled {\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color3);\n  cursor: not-allowed;\n}\n\n.validation-error {\n  background: var(--jp-error-color3);\n  color: var(--jp-error-color1);\n  padding: 8px;\n  border-radius: 4px;\n  margin-top: 8px;\n  font-size: 12px;\n}\n\n/* Validation Panel */\n.validation-panel {\n  background: var(--jp-layout-color2);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  padding: 20px;\n}\n\n.validation-panel h3 {\n  margin: 0 0 15px 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.2rem;\n  border-bottom: 1px solid var(--jp-border-color2);\n  padding-bottom: 8px;\n}\n\n.validation-status.valid {\n  color: var(--jp-success-color1);\n}\n\n.validation-status.invalid {\n  color: var(--jp-error-color1);\n}\n\n.validation-success {\n  background: var(--jp-success-color3);\n  color: var(--jp-success-color1);\n  padding: 10px;\n  border-radius: 4px;\n  border: 1px solid var(--jp-success-color2);\n}\n\n.validation-errors,\n.validation-warnings {\n  margin-top: 10px;\n}\n\n.validation-errors h4,\n.validation-warnings h4 {\n  margin: 0 0 8px 0;\n  color: var(--jp-error-color1);\n}\n\n.validation-warnings h4 {\n  color: var(--jp-warn-color1);\n}\n\n.validation-errors ul,\n.validation-warnings ul {\n  margin: 0;\n  padding-left: 20px;\n  color: var(--jp-ui-font-color2);\n}\n\n/* Deployment Panel */\n.deployment-panel {\n  background: var(--jp-layout-color2);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  padding: 20px;\n}\n\n.deployment-panel h3 {\n  margin: 0 0 15px 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.2rem;\n  border-bottom: 1px solid var(--jp-border-color2);\n  padding-bottom: 8px;\n}\n\n.deployment-status {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  margin-bottom: 15px;\n}\n\n.status-badge {\n  padding: 4px 8px;\n  border-radius: 12px;\n  font-size: 11px;\n  font-weight: 600;\n  text-transform: uppercase;\n}\n\n.status-badge.draft {\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color2);\n}\n\n.status-badge.deployed {\n  background: var(--jp-success-color3);\n  color: var(--jp-success-color1);\n}\n\n.status-badge.failed {\n  background: var(--jp-error-color3);\n  color: var(--jp-error-color1);\n}\n\n.workflow-id {\n  font-family: var(--jp-code-font-family);\n  font-size: 12px;\n  color: var(--jp-ui-font-color2);\n}\n\n.workflow-id code {\n  background: var(--jp-layout-color0);\n  padding: 2px 4px;\n  border-radius: 2px;\n  border: 1px solid var(--jp-border-color2);\n}\n\n.deployment-error {\n  background: var(--jp-error-color3);\n  color: var(--jp-error-color1);\n  padding: 10px;\n  border-radius: 4px;\n  margin-bottom: 15px;\n  font-size: 12px;\n  border: 1px solid var(--jp-error-color2);\n}\n\n.deploy-button {\n  padding: 10px 20px;\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n  font-size: 14px;\n  font-weight: 500;\n  margin-bottom: 10px;\n  width: 100%;\n}\n\n.deploy-button.ready {\n  background: var(--jp-brand-color1);\n  color: white;\n}\n\n.deploy-button.disabled {\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color3);\n  cursor: not-allowed;\n}\n\n.deploy-button:hover:not(:disabled) {\n  opacity: 0.9;\n}\n\n.deployment-info {\n  font-size: 12px;\n  color: var(--jp-ui-font-color2);\n  text-align: center;\n}\n\n/* Responsive Design */\n@media (max-width: 768px) {\n  .dal-header {\n    flex-direction: column;\n    align-items: flex-start;\n    gap: 15px;\n  }\n  \n  .connection-status {\n    flex-wrap: wrap;\n  }\n  \n  .projects-grid {\n    grid-template-columns: 1fr;\n  }\n  \n  .action-cards {\n    grid-template-columns: 1fr;\n  }\n  \n  .config-grid {\n    grid-template-columns: 1fr;\n  }\n  \n  .editor-content {\n    flex-direction: column;\n  }\n  \n  .left-panel {\n    border-right: none;\n    border-bottom: 1px solid var(--jp-border-color1);\n    max-width: none;\n  }\n}\n\n/* Dark mode adjustments */\n[data-jp-theme-light=\"false\"] .project-card:hover {\n  box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);\n}\n\n/* Runtime Orchestration Panel Styles */\n.runtime-orchestration-panel {\n  height: 100vh;\n  background: var(--jp-layout-color1);\n  display: flex;\n  flex-direction: column;\n}\n\n.panel-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 15px 20px;\n  background: var(--jp-layout-color2);\n  border-bottom: 1px solid var(--jp-border-color1);\n}\n\n.panel-header h2 {\n  margin: 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.3rem;\n}\n\n.header-info {\n  display: flex;\n  flex-direction: column;\n  align-items: flex-end;\n  font-size: 0.8rem;\n  color: var(--jp-ui-font-color2);\n}\n\n.panel-content {\n  display: flex;\n  flex: 1;\n  overflow: hidden;\n}\n\n.left-section, .right-section {\n  flex: 1;\n  padding: 20px;\n  overflow-y: auto;\n}\n\n.left-section {\n  border-right: 1px solid var(--jp-border-color1);\n  background: var(--jp-layout-color2);\n  max-width: 500px;\n}\n\n/* Sessions Section */\n.sessions-section {\n  margin-bottom: 30px;\n}\n\n.sessions-list {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.session-item {\n  background: var(--jp-layout-color1);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 6px;\n  padding: 15px;\n  cursor: pointer;\n  transition: all 0.2s ease;\n}\n\n.session-item:hover {\n  border-color: var(--jp-brand-color1);\n}\n\n.session-item.selected {\n  border-color: var(--jp-brand-color1);\n  background: var(--jp-brand-color3);\n}\n\n.session-summary {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.session-title {\n  font-weight: 500;\n  color: var(--jp-ui-font-color0);\n  font-size: 0.9rem;\n}\n\n.session-meta {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  font-size: 0.8rem;\n}\n\n.session-meta .status {\n  padding: 2px 6px;\n  border-radius: 10px;\n  font-size: 0.7rem;\n  font-weight: 500;\n  text-transform: uppercase;\n}\n\n.session-meta .status.active {\n  background: var(--jp-success-color3);\n  color: var(--jp-success-color0);\n}\n\n.session-meta .status.waiting_for_labels {\n  background: var(--jp-warn-color3);\n  color: var(--jp-warn-color0);\n}\n\n.session-meta .status.training {\n  background: var(--jp-info-color3);\n  color: var(--jp-info-color0);\n}\n\n.session-meta .status.completed {\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color1);\n}\n\n.accuracy {\n  font-size: 0.8rem;\n  color: var(--jp-ui-font-color2);\n}\n\n/* Command Log Section */\n.command-log-section {\n  margin-top: 20px;\n}\n\n.command-log {\n  max-height: 300px;\n  overflow-y: auto;\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 4px;\n  background: var(--jp-layout-color1);\n}\n\n.log-entry {\n  padding: 10px;\n  border-bottom: 1px solid var(--jp-border-color2);\n  font-size: 0.8rem;\n}\n\n.log-entry:last-child {\n  border-bottom: none;\n}\n\n.log-entry.accepted {\n  border-left: 3px solid var(--jp-success-color1);\n}\n\n.log-entry.completed {\n  border-left: 3px solid var(--jp-success-color1);\n  background: var(--jp-success-color3);\n}\n\n.log-entry.failed {\n  border-left: 3px solid var(--jp-error-color1);\n  background: var(--jp-error-color3);\n}\n\n.log-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 5px;\n}\n\n.command-id {\n  font-family: var(--jp-code-font-family);\n  background: var(--jp-layout-color3);\n  padding: 2px 4px;\n  border-radius: 3px;\n  font-size: 0.7rem;\n}\n\n.timestamp {\n  color: var(--jp-ui-font-color2);\n  font-size: 0.7rem;\n}\n\n.log-header .status {\n  padding: 2px 6px;\n  border-radius: 8px;\n  font-size: 0.6rem;\n  font-weight: 500;\n  text-transform: uppercase;\n}\n\n.log-header .status.accepted {\n  background: var(--jp-success-color3);\n  color: var(--jp-success-color0);\n}\n\n.log-header .status.completed {\n  background: var(--jp-success-color3);\n  color: var(--jp-success-color0);\n}\n\n.log-header .status.failed {\n  background: var(--jp-error-color3);\n  color: var(--jp-error-color0);\n}\n\n.log-message {\n  color: var(--jp-ui-font-color1);\n}\n\n/* Session Controls */\n.session-controls {\n  background: var(--jp-layout-color1);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  padding: 20px;\n}\n\n.session-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 15px;\n  padding-bottom: 10px;\n  border-bottom: 1px solid var(--jp-border-color2);\n}\n\n.session-header h4 {\n  margin: 0;\n  color: var(--jp-ui-font-color0);\n}\n\n.session-status {\n  font-weight: 500;\n  font-size: 0.8rem;\n  padding: 4px 8px;\n  border-radius: 12px;\n  background: var(--jp-layout-color3);\n}\n\n.session-info {\n  margin-bottom: 20px;\n}\n\n.info-row {\n  display: flex;\n  justify-content: space-between;\n  margin-bottom: 8px;\n  font-size: 0.9rem;\n}\n\n.info-row span:first-child {\n  color: var(--jp-ui-font-color2);\n  font-weight: 500;\n}\n\n.session-actions {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  margin-bottom: 20px;\n}\n\n.action-btn {\n  padding: 8px 12px;\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n  font-size: 0.8rem;\n  font-weight: 500;\n  transition: all 0.2s ease;\n}\n\n.action-btn.primary {\n  background: var(--jp-brand-color1);\n  color: white;\n}\n\n.action-btn.primary:hover {\n  background: var(--jp-brand-color2);\n}\n\n.action-btn.secondary {\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color1);\n  border: 1px solid var(--jp-border-color1);\n}\n\n.action-btn.secondary:hover {\n  background: var(--jp-layout-color2);\n}\n\n.action-btn.danger {\n  background: var(--jp-error-color1);\n  color: white;\n}\n\n.action-btn.danger:hover {\n  background: var(--jp-error-color2);\n}\n\n.action-btn:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n/* Labeling Section */\n.labeling-section {\n  margin-top: 15px;\n  padding: 15px;\n  background: var(--jp-layout-color2);\n  border-radius: 6px;\n  border: 1px solid var(--jp-border-color2);\n}\n\n.labeling-section h5 {\n  margin: 0 0 10px 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 0.9rem;\n}\n\n.samples-list {\n  max-height: 200px;\n  overflow-y: auto;\n  margin-bottom: 15px;\n}\n\n.sample-item {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 8px;\n  margin-bottom: 5px;\n  background: var(--jp-layout-color1);\n  border-radius: 4px;\n  border: 1px solid var(--jp-border-color1);\n  font-size: 0.8rem;\n}\n\n.sample-id {\n  font-family: var(--jp-code-font-family);\n  color: var(--jp-ui-font-color0);\n  font-weight: 500;\n}\n\n.sample-uncertainty {\n  color: var(--jp-ui-font-color2);\n}\n\n.label-btn {\n  background: var(--jp-brand-color1);\n  color: white;\n  border: none;\n  padding: 4px 8px;\n  border-radius: 3px;\n  cursor: pointer;\n  font-size: 0.7rem;\n}\n\n.label-btn:hover {\n  background: var(--jp-brand-color2);\n}\n\n.labeled-samples {\n  margin-top: 15px;\n  padding: 10px;\n  background: var(--jp-success-color3);\n  border-radius: 4px;\n}\n\n.labeled-samples h6 {\n  margin: 0 0 8px 0;\n  color: var(--jp-success-color0);\n  font-size: 0.8rem;\n}\n\n.labeled-item {\n  font-size: 0.7rem;\n  color: var(--jp-success-color0);\n  margin-bottom: 3px;\n  font-family: var(--jp-code-font-family);\n}\n\n/* Danger Zone */\n.danger-zone {\n  margin-top: 30px;\n  padding-top: 20px;\n  border-top: 1px solid var(--jp-border-color2);\n}\n\n/* No Session Selected */\n.no-session-selected {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n  text-align: center;\n  color: var(--jp-ui-font-color2);\n}\n\n.no-session-selected h3 {\n  margin: 0 0 10px 0;\n  color: var(--jp-ui-font-color1);\n}\n\n/* Phase Display */\n.phase-status {\n  font-size: 0.8rem;\n  font-weight: 500;\n}\n\n/* Action Button Updates */\n.action-button {\n  flex: 1;\n  padding: 8px 12px;\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n  font-size: 0.8rem;\n  font-weight: 500;\n  transition: all 0.2s ease;\n}\n\n.action-button.primary {\n  background: var(--jp-brand-color1);\n  color: white;\n}\n\n.action-button.primary:hover {\n  background: var(--jp-brand-color2);\n}\n\n.action-button.secondary {\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color1);\n  border: 1px solid var(--jp-border-color1);\n}\n\n.action-button.secondary:hover {\n  background: var(--jp-layout-color2);\n}\n\n.action-button:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n/* Responsive Design for Runtime Panel */\n@media (max-width: 768px) {\n  .panel-content {\n    flex-direction: column;\n  }\n  \n  .left-section {\n    border-right: none;\n    border-bottom: 1px solid var(--jp-border-color1);\n    max-width: none;\n    max-height: 50vh;\n  }\n  \n  .session-actions {\n    flex-direction: row;\n    flex-wrap: wrap;\n  }\n  \n  .action-btn {\n    flex: 1;\n    min-width: 120px;\n  }\n} \n\n/* Contributor Manager Styles */\n.contributor-manager {\n  background: var(--jp-layout-color2);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  padding: 20px;\n  margin-bottom: 20px;\n}\n\n.contributor-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 20px;\n  padding-bottom: 15px;\n  border-bottom: 1px solid var(--jp-border-color2);\n}\n\n.contributor-header h3 {\n  margin: 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.2rem;\n}\n\n.invite-button {\n  padding: 8px 16px;\n  background: var(--jp-brand-color1);\n  color: white;\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n  font-size: 14px;\n  font-weight: 500;\n}\n\n.invite-button:hover:not(:disabled) {\n  background: var(--jp-brand-color2);\n}\n\n.invite-button:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n.contributors-list {\n  display: flex;\n  flex-direction: column;\n  gap: 15px;\n}\n\n.contributor-item {\n  display: flex;\n  align-items: center;\n  gap: 20px;\n  padding: 15px;\n  background: var(--jp-layout-color1);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 6px;\n  transition: border-color 0.2s ease;\n}\n\n.contributor-item:hover {\n  border-color: var(--jp-brand-color1);\n}\n\n.contributor-info {\n  flex: 1;\n  min-width: 0;\n}\n\n.contributor-identity {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  margin-bottom: 8px;\n}\n\n.contributor-identity strong {\n  color: var(--jp-ui-font-color0);\n  font-size: 14px;\n}\n\n.contributor-details {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  font-size: 12px;\n  color: var(--jp-ui-font-color2);\n}\n\n.contributor-stats {\n  display: flex;\n  gap: 20px;\n  align-items: center;\n}\n\n.stat {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  min-width: 80px;\n}\n\n.stat-value {\n  font-size: 18px;\n  font-weight: 600;\n  color: var(--jp-ui-font-color0);\n}\n\n.stat-label {\n  font-size: 11px;\n  color: var(--jp-ui-font-color2);\n  text-align: center;\n  margin-top: 2px;\n}\n\n.contributor-actions {\n  display: flex;\n  gap: 8px;\n}\n\n.remove-button {\n  padding: 6px 12px;\n  background: var(--jp-error-color1);\n  color: white;\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n  font-size: 12px;\n}\n\n.remove-button:hover:not(:disabled) {\n  background: var(--jp-error-color2);\n}\n\n.remove-button:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n/* Status badges for contributors */\n.status-badge.invited {\n  background: var(--jp-warn-color3);\n  color: var(--jp-warn-color1);\n}\n\n.status-badge.accepted {\n  background: var(--jp-info-color3);\n  color: var(--jp-info-color1);\n}\n\n.status-badge.active {\n  background: var(--jp-success-color3);\n  color: var(--jp-success-color1);\n}\n\n.status-badge.inactive {\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color2);\n}\n\n/* Invitation Modal Styles */\n.modal-overlay {\n  position: fixed;\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  background: rgba(0, 0, 0, 0.5);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  z-index: 1000;\n}\n\n.modal {\n  background: var(--jp-layout-color1);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  width: 90%;\n  max-width: 500px;\n  max-height: 90vh;\n  overflow-y: auto;\n  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);\n}\n\n.modal-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 20px;\n  border-bottom: 1px solid var(--jp-border-color1);\n}\n\n.modal-header h3 {\n  margin: 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.3rem;\n}\n\n.modal-header .close-button {\n  background: none;\n  border: none;\n  font-size: 24px;\n  color: var(--jp-ui-font-color2);\n  cursor: pointer;\n  padding: 0;\n  width: 30px;\n  height: 30px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.modal-header .close-button:hover {\n  color: var(--jp-ui-font-color0);\n}\n\n.modal-content {\n  padding: 20px;\n}\n\n.form-group {\n  margin-bottom: 20px;\n}\n\n.form-group label {\n  display: block;\n  margin-bottom: 5px;\n  font-weight: 500;\n  color: var(--jp-ui-font-color1);\n  font-size: 13px;\n}\n\n.form-group label input[type=\"checkbox\"] {\n  margin-right: 8px;\n}\n\n.form-group input,\n.form-group select,\n.form-group textarea {\n  width: 100%;\n  padding: 10px;\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 4px;\n  background: var(--jp-layout-color0);\n  color: var(--jp-ui-font-color1);\n  font-family: var(--jp-ui-font-family);\n  font-size: 14px;\n  box-sizing: border-box;\n}\n\n.form-group input:focus,\n.form-group select:focus,\n.form-group textarea:focus {\n  outline: none;\n  border-color: var(--jp-brand-color1);\n  box-shadow: 0 0 0 2px var(--jp-brand-color3);\n}\n\n.form-group small {\n  display: block;\n  margin-top: 5px;\n  font-size: 12px;\n  color: var(--jp-ui-font-color2);\n}\n\n/* Review Step */\n.project-summary {\n  background: var(--jp-layout-color2);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  padding: 20px;\n  margin-bottom: 20px;\n}\n\n.project-summary h4 {\n  margin: 0 0 15px 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.1rem;\n  border-bottom: 1px solid var(--jp-border-color2);\n  padding-bottom: 8px;\n}\n\n.validation-result {\n  border-radius: 8px;\n  padding: 20px;\n  margin-bottom: 20px;\n}\n\n.validation-result.valid {\n  background: var(--jp-success-color3);\n  border: 1px solid var(--jp-success-color2);\n}\n\n.validation-result.invalid {\n  background: var(--jp-error-color3);\n  border: 1px solid var(--jp-error-color2);\n}\n\n.validation-result h4 {\n  margin: 0 0 15px 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.1rem;\n}\n\n.validation-success {\n  background: var(--jp-success-color3);\n  color: var(--jp-success-color1);\n  padding: 15px;\n  border-radius: 6px;\n  border: 1px solid var(--jp-success-color2);\n  font-weight: 500;\n}\n\n.validation-errors,\n.validation-warnings {\n  margin-top: 15px;\n}\n\n.validation-errors h5,\n.validation-warnings h5 {\n  margin: 0 0 10px 0;\n  color: var(--jp-error-color1);\n  font-size: 14px;\n}\n\n.validation-warnings h5 {\n  color: var(--jp-warn-color1);\n}\n\n.validation-errors ul,\n.validation-warnings ul {\n  margin: 0;\n  padding-left: 20px;\n  color: var(--jp-ui-font-color1);\n}\n\n.validation-errors li,\n.validation-warnings li {\n  margin-bottom: 5px;\n  font-size: 13px;\n}\n\n.rocrate-export {\n  background: var(--jp-layout-color2);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  padding: 20px;\n  text-align: center;\n}\n\n.rocrate-export h4 {\n  margin: 0 0 15px 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.1rem;\n}\n\n.export-button {\n  padding: 10px 20px;\n  background: var(--jp-brand-color1);\n  color: white;\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n  font-size: 14px;\n  font-weight: 500;\n}\n\n.export-button:hover {\n  background: var(--jp-brand-color2);\n}\n\n/* Wizard Footer */\n.wizard-footer {\n  background: var(--jp-layout-color2);\n  border-top: 1px solid var(--jp-border-color1);\n  padding: 20px;\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n}\n\n.navigation-buttons {\n  display: flex;\n  gap: 10px;\n}\n\n.cancel-button,\n.nav-button,\n.finalize-button {\n  padding: 10px 20px;\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n  font-size: 14px;\n  font-weight: 500;\n  transition: all 0.2s ease;\n}\n\n.cancel-button {\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color1);\n  border: 1px solid var(--jp-border-color1);\n}\n\n.cancel-button:hover:not(:disabled) {\n  background: var(--jp-layout-color1);\n}\n\n.nav-button {\n  background: var(--jp-brand-color1);\n  color: white;\n  min-width: 100px;\n}\n\n.nav-button:hover:not(:disabled) {\n  background: var(--jp-brand-color2);\n}\n\n.nav-button.previous {\n  background: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color1);\n  border: 1px solid var(--jp-border-color1);\n}\n\n.nav-button.previous:hover:not(:disabled) {\n  background: var(--jp-layout-color1);\n}\n\n.finalize-button {\n  background: var(--jp-success-color1);\n  color: white;\n  min-width: 120px;\n}\n\n.finalize-button:hover:not(:disabled) {\n  background: var(--jp-success-color2);\n}\n\n.cancel-button:disabled,\n.nav-button:disabled,\n.finalize-button:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n/* Responsive Design for Setup Wizard */\n@media (max-width: 768px) {\n  .config-grid,\n  .summary-grid {\n    grid-template-columns: 1fr;\n  }\n  \n  .step-indicator {\n    flex-wrap: wrap;\n    gap: 10px;\n  }\n  \n  .step {\n    flex: 1;\n    min-width: 80px;\n  }\n  \n  .step:not(:last-child)::after {\n    display: none;\n  }\n  \n  .wizard-content {\n    padding: 20px;\n  }\n  \n  .wizard-footer {\n    flex-direction: column;\n    gap: 15px;\n    align-items: stretch;\n  }\n  \n  .navigation-buttons {\n    width: 100%;\n    justify-content: space-between;\n  }\n  \n  .nav-button,\n  .finalize-button {\n    flex: 1;\n  }\n  \n  .cancel-button {\n    width: 100%;\n  }\n} \n\n/* Finalization Info */\n.finalization-info {\n  background: var(--jp-layout-color2);\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  padding: 20px;\n  margin-top: 20px;\n}\n\n.finalization-info h4 {\n  margin: 0 0 15px 0;\n  color: var(--jp-ui-font-color0);\n  font-size: 1.1rem;\n}\n\n.finalization-steps {\n  display: flex;\n  flex-direction: column;\n  gap: 15px;\n}\n\n.fin-step {\n  display: flex;\n  align-items: flex-start;\n  gap: 15px;\n  padding: 15px;\n  background: var(--jp-layout-color1);\n  border-radius: 6px;\n  border: 1px solid var(--jp-border-color2);\n}\n\n.step-icon {\n  width: 24px;\n  height: 24px;\n  background: var(--jp-brand-color1);\n  color: white;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 12px;\n  font-weight: 600;\n  flex-shrink: 0;\n}\n\n.fin-step div {\n  flex: 1;\n}\n\n.fin-step strong {\n  display: block;\n  color: var(--jp-ui-font-color0);\n  margin-bottom: 5px;\n  font-size: 14px;\n}\n\n.fin-step p {\n  margin: 0;\n  color: var(--jp-ui-font-color2);\n  font-size: 13px;\n  line-height: 1.4;\n} "],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ "./style/index.css":
/*!*************************!*\
  !*** ./style/index.css ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/styleDomAPI.js */ "./node_modules/style-loader/dist/runtime/styleDomAPI.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/insertBySelector.js */ "./node_modules/style-loader/dist/runtime/insertBySelector.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js */ "./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/insertStyleElement.js */ "./node_modules/style-loader/dist/runtime/insertStyleElement.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/styleTagTransform.js */ "./node_modules/style-loader/dist/runtime/styleTagTransform.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! !!../node_modules/css-loader/dist/cjs.js!./index.css */ "./node_modules/css-loader/dist/cjs.js!./style/index.css");

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default());
options.setAttributes = (_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default());

      options.insert = _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default().bind(null, "head");
    
options.domAPI = (_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default());
options.insertStyleElement = (_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default());

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()(_node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"], options);




       /* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"] && _node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals ? _node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals : undefined);


/***/ })

}]);
//# sourceMappingURL=style_index_css.53e8bfa8235adfd63e06.js.map