"""
Multi-User Request Validation for DVRE DAL
Note: Authentication is handled by DVRE frontend - this module validates requests
"""

import json
from datetime import datetime
from typing import Dict, List, Optional

# Role definitions for validation (should match DVRE/smart contract roles)
ROLE_PERMISSIONS = {
    'coordinator': [
        'submit_workflow',
        'start_querying', 
        'continue_querying',
        'prompt_training',
        'terminate_project',
        'modify_project',
        'view_all_data',
        'manage_users',
        'assign_samples',
        'view_project_data'
    ],
    'contributor': [
        'submit_labels',
        'view_project_data',
        'participate_in_querying',
        'view_assigned_samples'
    ]
}

class DVRERequestValidator:
    """
    Validates requests from DVRE frontend (trusts DVRE authentication)
    """
    
    @staticmethod
    def validate_request(request_data: dict) -> dict:
        """
        Validate request data from authenticated DVRE user
        Note: DVRE frontend handles MetaMask auth and role determination
        """
        user_wallet = request_data.get('user_wallet', '').lower()
        user_role = request_data.get('user_role', 'contributor')  # Default to contributor
        project_id = request_data.get('project_id')
        contract_address = request_data.get('contract_address')
        
        # Basic validation
        if not user_wallet or not user_wallet.startswith('0x'):
            raise ValueError("Invalid user_wallet address")
        
        if not project_id:
            raise ValueError("project_id is required")
        
        # Validate role (only coordinator and contributor)
        if user_role not in ROLE_PERMISSIONS:
            raise ValueError(f"Invalid user_role: {user_role}. Must be 'coordinator' or 'contributor'")
        
        return {
            'user_wallet': user_wallet,
            'user_role': user_role,
            'project_id': project_id,
            'contract_address': contract_address,
            'validated_at': datetime.now().isoformat(),
            'authenticated_by': 'DVRE'  # Indicates DVRE handled auth
        }
    
    @staticmethod
    def check_permission(user_role: str, required_permission: str) -> bool:
        """
        Check if user role has required permission
        """
        return required_permission in ROLE_PERMISSIONS.get(user_role, [])
    
    @staticmethod
    def require_permission(user_data: dict, required_permission: str):
        """
        Raise exception if user doesn't have required permission
        """
        user_role = user_data.get('user_role', 'contributor')
        if not DVRERequestValidator.check_permission(user_role, required_permission):
            raise PermissionError(f"Role '{user_role}' does not have permission '{required_permission}'")

class RoleBasedDataFilter:
    """
    Filter response data based on user role (from DVRE)
    """
    
    @staticmethod
    def filter_data_by_role(data: dict, user_data: dict) -> dict:
        """
        Filter response data based on user role determined by DVRE
        """
        role = user_data.get('user_role', 'contributor')
        user_wallet = user_data.get('user_wallet')
        
        if role == 'coordinator':
            # Coordinators see everything
            return data
        else:  # contributor
            # Contributors see limited data
            filtered_data = data.copy()
            
            # Remove sensitive coordinator-only data
            if 'all_submissions' in filtered_data:
                # Only show own submissions
                filtered_data['my_submissions'] = [
                    sub for sub in filtered_data.get('all_submissions', [])
                    if sub.get('contributor_wallet') == user_wallet
                ]
                del filtered_data['all_submissions']
            
            # Remove coordinator-specific fields
            coordinator_only_fields = ['management_data', 'all_user_data', 'financial_data']
            for field in coordinator_only_fields:
                filtered_data.pop(field, None)
            
            return filtered_data

class MultiUserSession:
    """
    Enhanced session management for multi-user Active Learning
    Note: User authentication handled by DVRE - this manages workflow state
    """
    
    def __init__(self, project_id: str, coordinator_wallet: str):
        self.project_id = project_id
        self.coordinator = coordinator_wallet.lower()
        self.contributors = {}  # wallet -> contributor_data
        self.active_samples = {}  # sample_id -> assigned_wallet
        self.submitted_labels = {}  # sample_id -> {wallet: label_data}
        self.consensus_threshold = 0.7  # Configurable consensus threshold
        self.created_at = datetime.now().isoformat()
        
    def add_contributor(self, contributor_wallet: str):
        """
        Add contributor to session
        """
        contributor_wallet = contributor_wallet.lower()
        if contributor_wallet not in self.contributors:
            self.contributors[contributor_wallet] = {
                'wallet': contributor_wallet,
                'joined_at': datetime.now().isoformat(),
                'samples_assigned': 0,
                'labels_submitted': 0,
                'accuracy_score': 0.0,
                'status': 'active'
            }
    
    def assign_samples_to_contributor(self, contributor_wallet: str, sample_ids: List[str]):
        """
        Assign specific samples to a contributor
        """
        contributor_wallet = contributor_wallet.lower()
        
        # Ensure contributor exists
        if contributor_wallet not in self.contributors:
            self.add_contributor(contributor_wallet)
        
        # Assign samples
        for sample_id in sample_ids:
            self.active_samples[sample_id] = contributor_wallet
        
        self.contributors[contributor_wallet]['samples_assigned'] += len(sample_ids)
        self.contributors[contributor_wallet]['last_assignment'] = datetime.now().isoformat()
    
    def submit_labels(self, contributor_wallet: str, labeled_samples: List[dict]) -> dict:
        """
        Handle label submission from contributor
        """
        contributor_wallet = contributor_wallet.lower()
        
        if contributor_wallet not in self.contributors:
            # Auto-add contributor if they're submitting labels (DVRE validated them)
            self.add_contributor(contributor_wallet)
        
        results = {
            'accepted': [],
            'rejected': [],
            'consensus_reached': []
        }
        
        for sample_data in labeled_samples:
            sample_id = sample_data['sample_id']
            
            # Check if contributor is assigned to this sample (or allow open labeling)
            assigned_contributor = self.active_samples.get(sample_id)
            if assigned_contributor and assigned_contributor != contributor_wallet:
                results['rejected'].append({
                    'sample_id': sample_id,
                    'reason': 'Sample assigned to different contributor'
                })
                continue
            
            # Store label submission
            if sample_id not in self.submitted_labels:
                self.submitted_labels[sample_id] = {}
            
            self.submitted_labels[sample_id][contributor_wallet] = {
                'label': sample_data['label'],
                'confidence': sample_data.get('confidence', 1.0),
                'submitted_at': datetime.now().isoformat(),
                'contributor': contributor_wallet,
                'metadata': sample_data.get('metadata', {})
            }
            
            results['accepted'].append(sample_id)
            
            # Check for consensus
            if self.check_sample_consensus(sample_id):
                results['consensus_reached'].append(sample_id)
        
        # Update contributor stats
        self.contributors[contributor_wallet]['labels_submitted'] += len(results['accepted'])
        self.contributors[contributor_wallet]['last_submission'] = datetime.now().isoformat()
        
        return results
    
    def check_sample_consensus(self, sample_id: str) -> bool:
        """
        Check if sample has reached consensus threshold
        """
        if sample_id not in self.submitted_labels:
            return False
        
        submissions = self.submitted_labels[sample_id]
        if len(submissions) < 2:  # Need at least 2 submissions for consensus
            return False
        
        # Simple majority consensus (can be enhanced with smart contract rules)
        label_counts = {}
        total_confidence = 0
        
        for submission in submissions.values():
            label = submission['label']
            confidence = submission['confidence']
            
            if label not in label_counts:
                label_counts[label] = {'count': 0, 'total_confidence': 0}
            
            label_counts[label]['count'] += 1
            label_counts[label]['total_confidence'] += confidence
            total_confidence += confidence
        
        # Check if any label has reached consensus
        for label, data in label_counts.items():
            consensus_score = data['total_confidence'] / total_confidence
            if consensus_score >= self.consensus_threshold:
                return True
        
        return False
    
    def get_consensus_labels(self) -> List[dict]:
        """
        Get all samples that have reached consensus
        """
        consensus_labels = []
        
        for sample_id, submissions in self.submitted_labels.items():
            if self.check_sample_consensus(sample_id):
                # Determine consensus label
                label_weights = {}
                for submission in submissions.values():
                    label = submission['label']
                    confidence = submission['confidence']
                    
                    if label not in label_weights:
                        label_weights[label] = 0
                    label_weights[label] += confidence
                
                # Get label with highest weight
                consensus_label = max(label_weights.items(), key=lambda x: x[1])
                
                consensus_labels.append({
                    'sample_id': sample_id,
                    'consensus_label': consensus_label[0],
                    'confidence_score': consensus_label[1] / sum(label_weights.values()),
                    'contributor_count': len(submissions),
                    'submissions': list(submissions.values()),
                    'consensus_reached_at': datetime.now().isoformat()
                })
        
        return consensus_labels
    
    def get_session_stats(self) -> dict:
        """
        Get session statistics
        """
        total_samples = len(self.active_samples)
        labeled_samples = len(self.submitted_labels)
        consensus_samples = len(self.get_consensus_labels())
        
        return {
            'project_id': self.project_id,
            'coordinator': self.coordinator,
            'total_contributors': len(self.contributors),
            'total_samples': total_samples,
            'labeled_samples': labeled_samples,
            'consensus_samples': consensus_samples,
            'progress_percentage': (consensus_samples / total_samples * 100) if total_samples > 0 else 0,
            'contributors': list(self.contributors.values()),
            'created_at': self.created_at,
            'last_updated': datetime.now().isoformat(),
            'consensus_threshold': self.consensus_threshold
        } 