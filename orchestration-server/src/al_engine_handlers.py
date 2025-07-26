import json
import uuid
from datetime import datetime
from .base_handlers import BaseStreamflowHandler, require_authentication
from .storage import workflow_db, al_sessions_db, al_commands_db


class ALEngineCommandHandler(BaseStreamflowHandler):
    @require_authentication()
    async def post(self):
        """
        Send commands to AL-engine for runtime orchestration (Phase 2)
        Enhanced with DAL workflow support
        Commands: start_querying, continue_querying, prompt_training, submit_labels, terminate_project
        """
        try:
            body = json.loads(self.request.body.decode('utf-8'))
            command_type = body.get('command_type')
            project_id = body.get('project_id')
            workflow_id = body.get('workflow_id')
            parameters = body.get('parameters', {})
            timestamp = body.get('timestamp')

            # Validation
            if not command_type:
                self.set_status(400)
                self.write(json.dumps({"error": "command_type is required"}))
                return
            if not project_id:
                self.set_status(400)
                self.write(json.dumps({"error": "project_id is required"}))
                return
            if not workflow_id:
                self.set_status(400)
                self.write(json.dumps({"error": "workflow_id is required"}))
                return

            # Verify workflow exists and is in correct phase
            workflow = workflow_db.get(workflow_id)
            if not workflow:
                self.set_status(404)
                self.write(json.dumps({"error": "Workflow not found"}))
                return
            
            if workflow.get('phase') != 'configuration_complete':
                self.set_status(400)
                self.write(json.dumps({"error": "Workflow not ready for runtime orchestration"}))
                return

            # Check if this is a DAL workflow for enhanced processing
            is_dal_workflow = workflow.get('metadata', {}).get('is_dal_workflow', False)

            # Generate command ID
            command_id = str(uuid.uuid4())
            
            # Process the command based on type
            try:
                if command_type == 'start_querying':
                    response = self.handle_start_querying(command_id, project_id, workflow_id, parameters, is_dal_workflow)
                elif command_type == 'continue_querying':
                    response = self.handle_continue_querying(command_id, project_id, workflow_id, parameters, is_dal_workflow)
                elif command_type == 'prompt_training':
                    response = self.handle_prompt_training(command_id, project_id, workflow_id, parameters, is_dal_workflow)
                elif command_type == 'submit_labels':
                    response = self.handle_submit_labels(command_id, project_id, workflow_id, parameters, is_dal_workflow)
                elif command_type == 'terminate_project':
                    response = self.handle_terminate_project(command_id, project_id, workflow_id, parameters, is_dal_workflow)
                else:
                    self.set_status(400)
                    self.write(json.dumps({"error": f"Unknown command_type: {command_type}"}))
                    return
                    
                # Store command for tracking
                al_commands_db[command_id] = {
                    "command_id": command_id,
                    "command_type": command_type,
                    "project_id": project_id,
                    "workflow_id": workflow_id,
                    "parameters": parameters,
                    "timestamp": timestamp,
                    "response": response,
                    "is_dal_workflow": is_dal_workflow,
                    "user_wallet": self.user_data.get('user_wallet'),
                    "user_role": self.user_data.get('user_role'),
                    "created_at": datetime.now().isoformat()
                }
                
                self.write(json.dumps(response))
                
            except Exception as e:
                self.set_status(500)
                self.write(json.dumps({
                    "command_id": command_id,
                    "status": "failed",
                    "message": str(e),
                    "timestamp": datetime.now().isoformat()
                }))
                
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

    def handle_start_querying(self, command_id, project_id, workflow_id, parameters, is_dal_workflow=False):
        """Handle start_querying command - send file path instructions to client-side AL engine"""
        query_count = parameters.get('query_count', 10)
        strategy_override = parameters.get('strategy_override')
        
        # Create new querying session (metadata only)
        session_id = str(uuid.uuid4())
        
        # Get DAL-specific configuration if available
        workflow = workflow_db.get(workflow_id)
        al_config = workflow.get('metadata', {}).get('al_config', {}) if workflow else {}
        
        session = {
            "session_id": session_id,
            "project_id": project_id,
            "workflow_id": workflow_id,
            "status": "active",
            "current_round": 1,
            "total_rounds": parameters.get('max_rounds', al_config.get('max_iterations', 10)),
            "created_at": datetime.now().isoformat(),
            "query_count": query_count,
            "strategy": strategy_override or al_config.get('query_strategy', 'uncertainty_sampling'),
            "is_dal_session": is_dal_workflow,
            "dal_config": al_config if is_dal_workflow else None,
            "client_side_execution": is_dal_workflow,
            # NO sample data stored - only metadata
            "instruction_history": []
        }
        
        # Store session
        if project_id not in al_sessions_db:
            al_sessions_db[project_id] = {}
        al_sessions_db[project_id][session_id] = session
        
        # Generate file path instructions for client-side AL engine
        if is_dal_workflow:
            print(f"DAL Orchestrator: Sending start_querying instruction to client AL-engine")
            print(f"DAL Orchestrator: Session {session_id} for DAL project {project_id}")
            print(f"DAL Orchestrator: Client should execute modal_run.py with local file paths")
            
            # Generate client instruction using DAL templates
            from .dal_templates import DALWorkflowTemplate
            client_instruction = DALWorkflowTemplate.generate_client_instruction(
                "start_querying", 
                {
                    "query_budget": query_count,
                    "strategy": session['strategy'],
                    "session_id": session_id,
                    "project_id": project_id,
                    "timestamp": datetime.now().isoformat(),
                    # Only file paths, NO actual data
                    "local_file_paths": {
                        "labeled_data": "path/to/labeled_data.npy",
                        "labeled_labels": "path/to/labeled_labels.npy", 
                        "unlabeled_data": "path/to/unlabeled_data.npy",
                        "config": "path/to/config.json",
                        "model_in": "path/to/model_in.pkl"
                    }
                }
            )
            
            # Store instruction in session history (NO actual sample data)
            session["instruction_history"].append({
                "instruction_type": "start_querying",
                "timestamp": datetime.now().isoformat(),
                "query_budget": query_count,
                "strategy": session['strategy']
            })
            
            response_data = {
                "session_id": session_id,
                "query_count": query_count,
                "is_dal_session": is_dal_workflow,
                "strategy": session['strategy'],
                "client_instruction": client_instruction,
                "execution_location": "client_side",
                "note": "Client will execute modal_run.py with local datasets. Smart contract handles voting/labeling."
            }
            
        else:
            print(f"Standard Orchestrator: Starting querying session {session_id} for project {project_id}")
            print(f"Standard Orchestrator: Query strategy: {session['strategy']}, Count: {query_count}")
            
            response_data = {
                "session_id": session_id,
                "query_count": query_count,
                "is_dal_session": is_dal_workflow,
                "strategy": session['strategy'],
                "execution_location": "server_side"
            }
        
        session["status"] = "waiting_for_smart_contract_results"
        
        response = {
            "command_id": command_id,
            "status": "accepted",
            "message": f"{'DAL client file path instruction sent' if is_dal_workflow else 'Standard'} querying session started successfully",
            "data": response_data,
            "timestamp": datetime.now().isoformat()
        }
        
        if is_dal_workflow:
            response["data"]["dal_features"] = {
                "template_used": "train_query",
                "model_type": al_config.get('model_type', 'RandomForestClassifier'),
                "consensus_threshold": al_config.get('consensus_threshold', 0.7),
                "client_files_expected": ["modal_run.py", "dal_engine.py"],
                "voting_handled_by": "smart_contract",
                "data_flow": "smart_contract → client_al_engine"
            }
        
        return response

    def handle_continue_querying(self, command_id, project_id, workflow_id, parameters, is_dal_workflow=False):
        """Handle continue_querying command - continue existing session"""
        session_id = parameters.get('session_id')
        if not session_id:
            raise ValueError("session_id is required for continue_querying")
        
        # Get existing session
        session = al_sessions_db.get(project_id, {}).get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found for project {project_id}")
        
        if session['status'] != 'waiting_for_labels':
            raise ValueError(f"Session {session_id} is not ready for querying (status: {session['status']})")
        
        # Move to next round
        session['current_round'] += 1
        session['status'] = 'active'
        
        # Enhanced mock continued querying for DAL workflows
        query_count = session.get('query_count', 10)
        
        if is_dal_workflow:
            print(f"DAL AL-Engine: Continuing querying session {session_id}, round {session['current_round']}")
            mock_samples = [
                {
                    "sample_id": f"dal_sample_r{session['current_round']}_{i}", 
                    "data": f"mock_dal_data_r{session['current_round']}_{i}", 
                    "uncertainty": 0.75 + (i * 0.02),
                    "feature_vector": f"feature_vector_r{session['current_round']}_{i}",
                    "metadata": {"source": "dal_template", "round": session['current_round']}
                }
                for i in range(query_count)
            ]
        else:
            mock_samples = [
                {"sample_id": f"sample_r{session['current_round']}_{i}", "data": f"mock_data_r{session['current_round']}_{i}", "uncertainty": 0.7 + (i * 0.02)}
                for i in range(query_count)
            ]
        
        session["queried_samples"] = mock_samples
        session["status"] = "waiting_for_labels"
        
        return {
            "command_id": command_id,
            "status": "accepted",
            "message": f"{'DAL' if is_dal_workflow else 'Standard'} querying continued for round {session['current_round']}",
            "data": {
                "session_id": session_id,
                "current_round": session['current_round'],
                "queried_samples": mock_samples,
                "query_count": len(mock_samples),
                "is_dal_session": is_dal_workflow
            },
            "timestamp": datetime.now().isoformat()
        }

    def handle_prompt_training(self, command_id, project_id, workflow_id, parameters, is_dal_workflow=False):
        """Handle prompt_training command - send training instructions to client-side AL engine"""
        session_id = parameters.get('session_id')
        training_config = parameters.get('training_config', {})
        
        if not session_id:
            raise ValueError("session_id is required for prompt_training")
        
        # Get existing session
        session = al_sessions_db.get(project_id, {}).get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found for project {project_id}")
        
        # Update session status
        session['status'] = 'training'
        session['last_training'] = datetime.now().isoformat()
        
        # Generate instructions for client-side AL engine training
        if is_dal_workflow:
            print(f"DAL Orchestrator: Sending training instruction to client AL-engine")
            print(f"DAL Orchestrator: Session {session_id} - client should execute modal_run.py training")
            
            # Generate client instruction for training
            from .dal_templates import DALWorkflowTemplate
            client_instruction = DALWorkflowTemplate.generate_client_instruction(
                "prompt_training",
                {
                    "session_id": session_id,
                    "labeled_data": "provided_by_client",
                    "training_config": training_config,
                    "project_id": project_id,
                    "timestamp": datetime.now().isoformat()
                }
            )
            
            # Mock client response (in real implementation, this would come from client)
            current_accuracy = session['accuracy_metrics'].get('accuracy', 0.75)
            new_accuracy = min(0.96, current_accuracy + 0.03)  # Better improvement for DAL
            
            session['accuracy_metrics'] = {
                'accuracy': new_accuracy,
                'precision': new_accuracy + 0.02,
                'recall': new_accuracy - 0.01,
                'f1_score': new_accuracy + 0.01,
                'training_time': 32.5,
                'round': session['current_round'],
                'model_type': 'RandomForestClassifier',
                'dal_enhanced': True,
                'execution_location': 'client_side'
            }
        else:
            print(f"Standard Orchestrator: Starting training for session {session_id}")
            print(f"Standard Orchestrator: Training config: {training_config}")
            
            # Standard training (server-side mock)
            current_accuracy = session['accuracy_metrics'].get('accuracy', 0.70)
            new_accuracy = min(0.95, current_accuracy + 0.02)
            
            session['accuracy_metrics'] = {
                'accuracy': new_accuracy,
                'precision': new_accuracy + 0.01,
                'recall': new_accuracy - 0.01,
                'f1_score': new_accuracy,
                'training_time': 45.2,
                'round': session['current_round'],
                'execution_location': 'server_side'
            }
        
        session['status'] = 'active'  # Ready for next round
        
        response = {
            "command_id": command_id,
            "status": "completed",
            "message": f"{'DAL client training instruction sent' if is_dal_workflow else 'Standard'} training completed successfully",
            "data": {
                "session_id": session_id,
                "accuracy_metrics": session['accuracy_metrics'],
                "training_completed": True,
                "is_dal_session": is_dal_workflow,
                "execution_location": "client_side" if is_dal_workflow else "server_side"
            },
            "timestamp": datetime.now().isoformat()
        }
        
        if is_dal_workflow:
            response["data"]["client_instruction"] = client_instruction
            
        return response

    def handle_submit_labels(self, command_id, project_id, workflow_id, parameters, is_dal_workflow=False):
        """Handle submit_labels command - redirect to smart contract (orchestrator doesn't process labels)"""
        session_id = parameters.get('session_id')
        labeled_samples = parameters.get('labeled_samples', [])
        
        if not session_id:
            raise ValueError("session_id is required for submit_labels")
        
        # Get existing session
        session = al_sessions_db.get(project_id, {}).get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found for project {project_id}")
        
        if is_dal_workflow:
            print(f"DAL Orchestrator: Labels should be submitted to smart contract, not orchestrator")
            print(f"DAL Orchestrator: Smart contract will handle voting and send results to client AL-engine")
            
            # Update session metadata only (no label processing)
            session["instruction_history"].append({
                "instruction_type": "labels_redirected_to_smart_contract",
                "timestamp": datetime.now().isoformat(),
                "sample_count": len(labeled_samples),
                "note": "Smart contract handles voting and consensus"
            })
            
            return {
                "command_id": command_id,
                "status": "redirected_to_smart_contract",
                "message": "Labels should be submitted to smart contract. Orchestrator does not process voting/labeling.",
                "data": {
                    "session_id": session_id,
                    "redirect_to": "smart_contract",
                    "sample_count": len(labeled_samples),
                    "voting_process": "smart_contract_handles_consensus",
                    "result_delivery": "smart_contract → client_al_engine",
                    "orchestrator_role": "coordination_only"
                },
                "timestamp": datetime.now().isoformat()
            }
        else:
            print(f"Standard Orchestrator: Processing {len(labeled_samples)} labeled samples for session {session_id}")
            
            # Standard processing for non-DAL workflows
            if 'labeled_data_count' not in session:
                session['labeled_data_count'] = 0
            
            session['labeled_data_count'] += len(labeled_samples)
            session['last_labeling'] = datetime.now().isoformat()
            
            # Check if ready for next phase
            if session['status'] == 'waiting_for_smart_contract_results':
                session['status'] = 'active'  # Ready for training or next query
            
            return {
                "command_id": command_id,
                "status": "accepted",
                "message": f"Processed {len(labeled_samples)} labeled samples (Standard session)",
                "data": {
                    "session_id": session_id,
                    "processed_samples": len(labeled_samples),
                    "total_labeled_samples": session['labeled_data_count'],
                    "session_status": session['status'],
                    "is_dal_session": is_dal_workflow
                },
                "timestamp": datetime.now().isoformat()
            }

    def handle_terminate_project(self, command_id, project_id, workflow_id, parameters, is_dal_workflow=False):
        """Handle terminate_project command - clean up and finalize"""
        # Clean up all sessions for this project
        sessions_removed = 0
        if project_id in al_sessions_db:
            sessions_removed = len(al_sessions_db[project_id])
            del al_sessions_db[project_id]
        
        # Update workflow status
        workflow = workflow_db.get(workflow_id)
        if workflow:
            workflow['status'] = 'TERMINATED'
            workflow['terminated_at'] = datetime.now().isoformat()
            workflow['phase'] = 'terminated'
        
        if is_dal_workflow:
            print(f"DAL AL-Engine: Terminating DAL project {project_id}, removed {sessions_removed} sessions")
            # Clean up DAL-specific temp files if needed
            dal_file_paths = workflow.get('dal_file_paths') if workflow else None
            if dal_file_paths and dal_file_paths.get('temp_dir'):
                import shutil
                try:
                    shutil.rmtree(dal_file_paths['temp_dir'])
                    print(f"DAL AL-Engine: Cleaned up temp directory: {dal_file_paths['temp_dir']}")
                except Exception as e:
                    print(f"DAL AL-Engine: Warning - could not clean temp directory: {e}")
        else:
            print(f"Standard AL-Engine: Terminating project {project_id}, removed {sessions_removed} sessions")
        
        return {
            "command_id": command_id,
            "status": "completed",
            "message": f"{'DAL' if is_dal_workflow else 'Standard'} project {project_id} terminated successfully",
            "data": {
                "project_id": project_id,
                "workflow_id": workflow_id,
                "sessions_removed": sessions_removed,
                "terminated_at": datetime.now().isoformat(),
                "is_dal_project": is_dal_workflow
            },
            "timestamp": datetime.now().isoformat()
        } 