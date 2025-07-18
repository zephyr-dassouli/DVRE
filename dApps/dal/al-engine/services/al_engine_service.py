"""
AL Engine Service

This service orchestrates the active learning workflow using the plugin system.
It manages experiments, coordinates between plugins, and provides a unified interface.
"""

import numpy as np
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from interfaces.base import ALFrameworkPlugin, SampleInfo
from plugin_registry import registry

logger = logging.getLogger(__name__)

class ALEngineService:
    """
    Main AL Engine Service
    
    This service manages active learning experiments using the plugin architecture.
    It coordinates between framework, model, strategy, and dataset plugins.
    """
    
    def __init__(self):
        """Initialize the AL Engine service."""
        self.current_framework: Optional[ALFrameworkPlugin] = None
        self.experiment_config: Optional[Dict[str, Any]] = None
        self.experiment_id: Optional[str] = None
        self.current_sample_index: int = 0
        self.unlabeled_indices: List[int] = []
        self.labeled_indices: List[int] = []
        self.experiment_state = "idle"  # idle, initialized, training, querying
        
        logger.info("AL Engine service initialized")
    
    def initialize_experiment(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Initialize a new AL experiment.
        
        Args:
            config: Experiment configuration containing:
                - experiment_id: Unique experiment identifier
                - al_framework: Framework configuration
                - model: Model configuration
                - query_strategy: Query strategy configuration
                - dataset: Dataset configuration
                
        Returns:
            Initialization result
        """
        try:
            logger.info("Initializing AL experiment")
            
            # Store experiment configuration
            self.experiment_config = config
            self.experiment_id = config.get("experiment_id", f"exp_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            
            # Get framework configuration
            framework_config = config.get("al_framework", {})
            framework_type = framework_config.get("type", "sklearn")
            
            # Initialize framework plugin
            self.current_framework = registry.get_framework(framework_type)
            self.current_framework.initialize(config)
            
            # Perform initial training
            dataset_config = config.get("dataset", {})
            initial_training_result = self._perform_initial_training(dataset_config)
            
            if initial_training_result["status"] == "success":
                self.experiment_state = "initialized"
                logger.info(f"Experiment {self.experiment_id} initialized successfully")
                
                return {
                    "status": "success",
                    "experiment_id": self.experiment_id,
                    "framework": framework_type,
                    "initial_training": initial_training_result,
                    "available_plugins": registry.list_available()
                }
            else:
                self.experiment_state = "error"
                return {
                    "status": "error",
                    "error": "Initial training failed",
                    "details": initial_training_result
                }
                
        except Exception as e:
            logger.error(f"Experiment initialization failed: {str(e)}")
            self.experiment_state = "error"
            return {
                "status": "error",
                "error": str(e)
            }
    
    def _perform_initial_training(self, dataset_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform initial training (warm start) on the dataset.
        
        Args:
            dataset_config: Dataset configuration
            
        Returns:
            Training result
        """
        try:
            # For now, use the framework's built-in dataset loading
            # In the future, this will use dataset plugins
            
            # The framework plugin handles initial training internally
            # This is a placeholder for when we have separate dataset plugins
            
            # Get initial training data from framework
            if hasattr(self.current_framework, 'X_train') and hasattr(self.current_framework, 'y_train'):
                X_train = self.current_framework.X_train
                y_train = self.current_framework.y_train
                
                # Perform initial training
                result = self.current_framework.train_initial_model(X_train, y_train)
                
                # Initialize unlabeled indices
                if hasattr(self.current_framework, 'X_unlabeled'):
                    self.unlabeled_indices = list(range(len(self.current_framework.X_unlabeled)))
                    self.labeled_indices = []
                
                return result
            else:
                return {
                    "status": "error",
                    "error": "Framework does not provide training data"
                }
                
        except Exception as e:
            logger.error(f"Initial training failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def get_next_sample(self) -> Dict[str, Any]:
        """
        Get the next most informative sample for labeling.
        
        Returns:
            Sample information for labeling
        """
        try:
            if not self.current_framework:
                raise ValueError("No experiment initialized")
            
            if self.experiment_state not in ["initialized", "training"]:
                raise ValueError(f"Invalid experiment state: {self.experiment_state}")
            
            if not self.unlabeled_indices:
                return {
                    "status": "no_samples",
                    "message": "No unlabeled samples available"
                }
            
            self.experiment_state = "querying"
            
            # Get unlabeled data
            X_unlabeled = self.current_framework.X_unlabeled[self.unlabeled_indices]
            
            # Query for most informative sample
            selected_indices = self.current_framework.query_samples(X_unlabeled, n_samples=1)
            
            if not selected_indices:
                return {
                    "status": "error",
                    "error": "Query strategy returned no samples"
                }
            
            # Map back to original indices
            original_index = self.unlabeled_indices[selected_indices[0]]
            sample_features = X_unlabeled[selected_indices[0]]
            
            # Get predictions and uncertainty
            predictions, uncertainties = self.current_framework.predict(sample_features.reshape(1, -1))
            
            # Create sample info
            sample_info = {
                "sample_id": f"sample_{original_index}",
                "sample_index": original_index,
                "features": self._format_features(sample_features),
                "uncertainty_score": float(uncertainties[0]) if len(uncertainties) > 0 else 0.0,
                "predicted_label": int(predictions[0]) if len(predictions) > 0 else 0,
                "metadata": {
                    "experiment_id": self.experiment_id,
                    "query_timestamp": datetime.now().isoformat(),
                    "remaining_unlabeled": len(self.unlabeled_indices) - 1
                }
            }
            
            # Store current sample for labeling
            self.current_sample_index = original_index
            
            logger.info(f"Selected sample {original_index} for labeling with uncertainty {sample_info['uncertainty_score']:.3f}")
            
            return {
                "status": "success",
                "sample": sample_info
            }
            
        except Exception as e:
            logger.error(f"Failed to get next sample: {str(e)}")
            self.experiment_state = "error"
            return {
                "status": "error",
                "error": str(e)
            }
    
    def _format_features(self, features: np.ndarray) -> Dict[str, float]:
        """
        Format feature array as a dictionary.
        
        Args:
            features: Feature array
            
        Returns:
            Dictionary of feature names to values
        """
        # For wine dataset, use known feature names
        wine_feature_names = [
            'alcohol', 'malic_acid', 'ash', 'alcalinity_of_ash', 'magnesium',
            'total_phenols', 'flavanoids', 'nonflavanoid_phenols', 'proanthocyanins',
            'color_intensity', 'hue', 'od280/od315_of_diluted_wines', 'proline'
        ]
        
        if len(features) == len(wine_feature_names):
            return {name: float(value) for name, value in zip(wine_feature_names, features)}
        else:
            return {f"feature_{i}": float(value) for i, value in enumerate(features)}
    
    def submit_label(self, sample_id: str, label: int) -> Dict[str, Any]:
        """
        Submit a label for a sample and update the model.
        
        Args:
            sample_id: ID of the sample being labeled
            label: The label to assign to the sample
            
        Returns:
            Label submission result
        """
        try:
            if not self.current_framework:
                raise ValueError("No experiment initialized")
            
            if self.experiment_state != "querying":
                raise ValueError(f"Invalid experiment state for labeling: {self.experiment_state}")
            
            # Extract sample index from sample_id
            if not sample_id.startswith("sample_"):
                raise ValueError(f"Invalid sample_id format: {sample_id}")
            
            try:
                sample_index = int(sample_id.split("_")[1])
            except (IndexError, ValueError):
                raise ValueError(f"Could not parse sample index from sample_id: {sample_id}")
            
            # Verify this is the current sample
            if sample_index != self.current_sample_index:
                raise ValueError(f"Sample index mismatch. Expected {self.current_sample_index}, got {sample_index}")
            
            # Find the position in unlabeled_indices
            try:
                unlabeled_position = self.unlabeled_indices.index(sample_index)
            except ValueError:
                raise ValueError(f"Sample {sample_index} not found in unlabeled pool")
            
            # Get the sample features
            X_sample = self.current_framework.X_unlabeled[sample_index:sample_index+1]
            y_sample = np.array([label])
            
            # Update the model with the new labeled sample
            update_result = self.current_framework.update_model(X_sample, y_sample)
            
            if update_result["status"] == "success":
                # Move sample from unlabeled to labeled
                self.unlabeled_indices.remove(sample_index)
                self.labeled_indices.append(sample_index)
                # Update experiment state
                self.experiment_state = "initialized" if self.unlabeled_indices else "completed"
                logger.info(f"Successfully labeled sample {sample_index} with label {label}")
                return {
                    "status": "success",
                    "sample_id": sample_id,
                    "label": label,
                    "model_update": update_result,
                    "remaining_unlabeled": len(self.unlabeled_indices),
                    "total_labeled": len(self.labeled_indices)
                }
            else:
                self.experiment_state = "error"
                return {
                    "status": "error",
                    "error": "Model update failed",
                    "details": update_result
                }
            
        except Exception as e:
            logger.error(f"Failed to submit label: {str(e)}")
            self.experiment_state = "error"
            return {
                "status": "error",
                "error": str(e)
            }
    
    def get_metrics(self) -> Dict[str, Any]:
        """
        Get current model performance metrics.
        
        Returns:
            Model metrics
        """
        try:
            if not self.current_framework:
                return {
                    "status": "error",
                    "error": "No experiment initialized"
                }
            
            metrics = self.current_framework.get_metrics()
            
            return {
                "status": "success",
                "metrics": {
                    "accuracy": metrics.accuracy,
                    "f1_score": metrics.f1_score,
                    "precision": metrics.precision,
                    "recall": metrics.recall,
                    "labeled_count": metrics.labeled_count,
                    "total_samples": metrics.total_samples,
                    "last_updated": metrics.last_updated,
                    "experiment_state": self.experiment_state,
                    "remaining_unlabeled": len(self.unlabeled_indices)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get metrics: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get AL engine status and configuration.
        
        Returns:
            Status information
        """
        try:
            return {
                "status": "success",
                "engine_status": self.experiment_state,
                "experiment_id": self.experiment_id,
                "framework": self.current_framework.PLUGIN_NAME if self.current_framework else None,
                "configuration": self.experiment_config,
                "statistics": {
                    "labeled_samples": len(self.labeled_indices),
                    "unlabeled_samples": len(self.unlabeled_indices),
                    "total_samples": len(self.labeled_indices) + len(self.unlabeled_indices)
                },
                "available_plugins": registry.list_available()
            }
            
        except Exception as e:
            logger.error(f"Failed to get status: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def reset(self) -> Dict[str, Any]:
        """
        Reset the AL engine state.
        
        Returns:
            Reset confirmation
        """
        try:
            self.current_framework = None
            self.experiment_config = None
            self.experiment_id = None
            self.current_sample_index = 0
            self.unlabeled_indices = []
            self.labeled_indices = []
            self.experiment_state = "idle"
            
            logger.info("AL Engine reset successfully")
            
            return {
                "status": "success",
                "message": "AL Engine reset successfully"
            }
            
        except Exception as e:
            logger.error(f"Failed to reset engine: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            } 