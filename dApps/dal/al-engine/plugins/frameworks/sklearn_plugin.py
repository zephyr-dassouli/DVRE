"""
Scikit-Learn AL Framework Plugin

This plugin provides Active Learning functionality using scikit-learn models
with optional modAL integration for advanced query strategies.
"""

import numpy as np
from typing import Dict, Any, List, Tuple
from datetime import datetime
import logging

from interfaces.base import ALFrameworkPlugin, ModelMetrics
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import load_wine
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

# Import modAL for active learning
try:
    from modAL.models import ActiveLearner
    from modAL.uncertainty import uncertainty_sampling
    MODAL_AVAILABLE = True
except ImportError:
    MODAL_AVAILABLE = False
    logging.warning("modAL not available, sklearn plugin will use fallback implementation")

logger = logging.getLogger(__name__)

class SklearnALPlugin(ALFrameworkPlugin):
    """
    Scikit-Learn Active Learning Plugin
    
    This plugin provides AL functionality using scikit-learn models
    with optional modAL integration for advanced query strategies.
    """
    
    PLUGIN_NAME = "sklearn"
    
    def __init__(self):
        """Initialize the sklearn AL plugin."""
        self.model = None
        self.config = None
        self.X_train = None
        self.y_train = None
        self.X_unlabeled = None
        self.scaler = StandardScaler()
        self.training_history = []
        self.is_initialized = False
        
        logger.info("Scikit-learn AL plugin initialized")
    
    def initialize(self, config: Dict[str, Any]) -> None:
        """
        Initialize the AL framework with configuration.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        
        # Extract configuration
        model_config = config.get('model', {})
        dataset_config = config.get('dataset', {})
        
        # Initialize model based on config
        model_type = model_config.get('type', 'random_forest')
        model_params = model_config.get('parameters', {})
        
        if model_type == 'random_forest':
            estimator = RandomForestClassifier(**model_params)
        else:
            # Default to random forest
            estimator = RandomForestClassifier(n_estimators=50, random_state=42)
        
        # Load dataset
        self._load_dataset(dataset_config)
        
        # Initialize active learner if modAL is available
        if MODAL_AVAILABLE:
            self.model = ActiveLearner(
                estimator=estimator,
                query_strategy=uncertainty_sampling
            )
        else:
            # Fallback implementation
            self.estimator = estimator
            self.model = None
        
        self.is_initialized = True
        logger.info("Scikit-learn AL plugin initialized with configuration")
    
    def _load_dataset(self, dataset_config: Dict[str, Any]):
        """
        Load and prepare the dataset.
        
        Args:
            dataset_config: Dataset configuration
        """
        dataset_type = dataset_config.get('type', 'wine')
        
        if dataset_type == 'wine':
            # Load wine dataset
            wine_data = load_wine()
            X, y = wine_data.data, wine_data.target
            
            # Split into initial training and unlabeled pool
            X_train, X_unlabeled, y_train, y_unlabeled = train_test_split(
                X, y, test_size=0.7, random_state=42, stratify=y
            )
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_unlabeled_scaled = self.scaler.transform(X_unlabeled)
            
            self.X_train = X_train_scaled
            self.y_train = y_train
            self.X_unlabeled = X_unlabeled_scaled
            self.y_unlabeled = y_unlabeled  # For evaluation purposes
            
            # Generate synthetic samples if requested
            n_synthetic = dataset_config.get('synthetic_samples', 100)
            if n_synthetic > 0:
                synthetic_samples = self._generate_synthetic_samples(n_synthetic)
                self.X_unlabeled = np.vstack([self.X_unlabeled, synthetic_samples])
        
        logger.info(f"Dataset loaded: {len(self.X_train)} training, {len(self.X_unlabeled)} unlabeled")
    
    def _generate_synthetic_samples(self, n_samples: int) -> np.ndarray:
        """
        Generate synthetic samples based on the training data distribution.
        
        Args:
            n_samples: Number of synthetic samples to generate
            
        Returns:
            Synthetic samples
        """
        # Simple synthetic generation: add noise to existing samples
        np.random.seed(42)
        
        # Randomly select samples to use as base
        base_indices = np.random.choice(len(self.X_train), n_samples, replace=True)
        base_samples = self.X_train[base_indices]
        
        # Add Gaussian noise
        noise_std = 0.1 * np.std(self.X_train, axis=0)
        noise = np.random.normal(0, noise_std, base_samples.shape)
        
        synthetic_samples = base_samples + noise
        
        logger.info(f"Generated {n_samples} synthetic samples")
        return synthetic_samples
    
    def train_initial_model(self, X_train: np.ndarray, y_train: np.ndarray) -> Dict[str, Any]:
        """
        Train initial model on labeled data.
        
        Args:
            X_train: Training features
            y_train: Training labels
            
        Returns:
            Training result
        """
        if not self.is_initialized:
            raise ValueError("Plugin not initialized. Call initialize() first.")
        
        try:
            if MODAL_AVAILABLE and self.model:
                # Use modAL
                self.model.fit(X_train, y_train)
            else:
                # Use fallback
                self.estimator.fit(X_train, y_train)
            
            # Update training data
            self.X_train = X_train
            self.y_train = y_train
            
            # Calculate initial metrics
            initial_metrics = self._calculate_metrics()
            
            # Log training event
            self._log_training_event("initial_training", len(y_train))
            
            return {
                "status": "success",
                "samples_trained": len(y_train),
                "initial_metrics": initial_metrics.__dict__
            }
            
        except Exception as e:
            logger.error(f"Initial training failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def query_samples(self, X_unlabeled: np.ndarray, n_samples: int) -> List[int]:
        """
        Select most informative samples to label.
        
        Args:
            X_unlabeled: Unlabeled data pool
            n_samples: Number of samples to select
            
        Returns:
            List of indices of selected samples
        """
        if not self.is_initialized:
            raise ValueError("Plugin not initialized. Call initialize() first.")
        
        try:
            if MODAL_AVAILABLE and self.model:
                # Use modAL uncertainty sampling
                query_indices, _ = self.model.query(X_unlabeled, n_instances=n_samples)
                return query_indices.tolist()
            else:
                # Fallback: random sampling
                indices = np.random.choice(len(X_unlabeled), n_samples, replace=False)
                return indices.tolist()
                
        except Exception as e:
            logger.error(f"Query failed: {str(e)}")
            return []
    
    def update_model(self, X_new: np.ndarray, y_new: np.ndarray) -> Dict[str, Any]:
        """
        Update model with new labeled samples.
        
        Args:
            X_new: New training features
            y_new: New training labels
            
        Returns:
            Update result
        """
        if not self.is_initialized:
            raise ValueError("Plugin not initialized. Call initialize() first.")
        
        try:
            # Get metrics before update
            metrics_before = self._calculate_metrics()
            
            if MODAL_AVAILABLE and self.model:
                # Use modAL
                self.model.teach(X_new, y_new)
            else:
                # Fallback: retrain with all data
                self.X_train = np.vstack([self.X_train, X_new])
                self.y_train = np.hstack([self.y_train, y_new])
                self.estimator.fit(self.X_train, self.y_train)
            
            # Get metrics after update
            metrics_after = self._calculate_metrics()
            
            # Log update event
            self._log_training_event("model_update", len(y_new))
            
            return {
                "status": "success",
                "samples_added": len(y_new),
                "metrics_before": metrics_before.__dict__,
                "metrics_after": metrics_after.__dict__
            }
            
        except Exception as e:
            logger.error(f"Model update failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def predict(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict labels and uncertainties.
        
        Args:
            X: Features to predict
            
        Returns:
            Tuple of (predictions, uncertainties)
        """
        if not self.is_initialized:
            raise ValueError("Plugin not initialized. Call initialize() first.")
        
        try:
            if MODAL_AVAILABLE and self.model:
                predictions = self.model.predict(X)
                probabilities = self.model.predict_proba(X)
            else:
                predictions = self.estimator.predict(X)
                probabilities = self.estimator.predict_proba(X)
            
            # Calculate uncertainties (1 - max probability)
            uncertainties = 1 - np.max(probabilities, axis=1)
            
            return predictions, uncertainties
            
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            return np.array([]), np.array([])
    
    def get_metrics(self) -> ModelMetrics:
        """
        Get current model performance metrics.
        
        Returns:
            ModelMetrics object
        """
        return self._calculate_metrics()
    
    def _calculate_metrics(self) -> ModelMetrics:
        """Calculate current model performance metrics."""
        if not self.is_initialized or self.X_train is None:
            return ModelMetrics(
                accuracy=0.0, f1_score=0.0, precision=0.0, recall=0.0,
                labeled_count=0, total_samples=0, last_updated="",
                model_info={}
            )
        
        try:
            # Predict on training data
            if MODAL_AVAILABLE and self.model:
                y_pred = self.model.predict(self.X_train)
                model_info = {
                    "library": "modAL",
                    "algorithm": type(self.model.estimator).__name__,
                    "parameters": self.model.estimator.get_params()
                }
            else:
                y_pred = self.estimator.predict(self.X_train)
                model_info = {
                    "library": "scikit-learn",
                    "algorithm": type(self.estimator).__name__,
                    "parameters": self.estimator.get_params()
                }
            
            # Calculate metrics
            accuracy = accuracy_score(self.y_train, y_pred)
            f1 = f1_score(self.y_train, y_pred, average='weighted')
            precision = precision_score(self.y_train, y_pred, average='weighted')
            recall = recall_score(self.y_train, y_pred, average='weighted')
            
            return ModelMetrics(
                accuracy=float(accuracy),
                f1_score=float(f1),
                precision=float(precision),
                recall=float(recall),
                labeled_count=len(self.y_train),
                total_samples=len(self.y_train) + len(self.X_unlabeled),
                last_updated=datetime.now().isoformat(),
                model_info=model_info
            )
            
        except Exception as e:
            logger.error(f"Metrics calculation failed: {str(e)}")
            return ModelMetrics(
                accuracy=0.0, f1_score=0.0, precision=0.0, recall=0.0,
                labeled_count=len(self.y_train) if self.y_train is not None else 0,
                total_samples=0, last_updated="", model_info={}
            )
    
    def get_state(self) -> Dict[str, Any]:
        """
        Get current framework state.
        
        Returns:
            Framework state
        """
        return {
            "config": self.config,
            "is_initialized": self.is_initialized,
            "training_history": self.training_history,
            "labeled_count": len(self.y_train) if self.y_train is not None else 0
        }
    
    def load_state(self, state: Dict[str, Any]) -> None:
        """
        Load framework state.
        
        Args:
            state: Previously saved state
        """
        self.config = state.get("config")
        self.is_initialized = state.get("is_initialized", False)
        self.training_history = state.get("training_history", [])
        
        if self.is_initialized and self.config:
            self.initialize(self.config)
    
    def _log_training_event(self, event_type: str, n_samples: int):
        """
        Log training events.
        
        Args:
            event_type: Type of training event
            n_samples: Number of samples involved
        """
        event = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "samples": n_samples,
            "total_labeled": len(self.y_train) if self.y_train is not None else 0
        }
        
        self.training_history.append(event)
        logger.info(f"Training event: {event_type} with {n_samples} samples") 