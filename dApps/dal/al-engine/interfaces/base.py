"""
Base Plugin Interfaces for AL Engine

This module defines the core interfaces that all plugins must implement.
These interfaces ensure consistency and interoperability between different
AL frameworks, models, query strategies, and datasets.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Tuple, Optional, Union
import numpy as np
from dataclasses import dataclass

@dataclass
class SampleInfo:
    """Information about a sample for labeling."""
    sample_id: str
    features: Dict[str, float]
    uncertainty_score: float
    metadata: Dict[str, Any]

@dataclass
class ModelMetrics:
    """Model performance metrics."""
    accuracy: float
    f1_score: float
    precision: float
    recall: float
    labeled_count: int
    total_samples: int
    last_updated: str
    model_info: Dict[str, Any]

class ALFrameworkPlugin(ABC):
    """
    Base interface for Active Learning framework plugins.
    
    This interface defines the contract that all AL framework plugins
    (modAL, ALiPy, custom implementations) must follow.
    """
    
    @abstractmethod
    def initialize(self, config: Dict[str, Any]) -> None:
        """
        Initialize the AL framework with configuration.
        
        Args:
            config: Configuration dictionary containing:
                - model: Model configuration
                - query_strategy: Query strategy configuration
                - dataset: Dataset configuration
                - update_strategy: Model update strategy
        """
        pass
    
    @abstractmethod
    def train_initial_model(self, X_train: np.ndarray, y_train: np.ndarray) -> Dict[str, Any]:
        """
        Train initial model on labeled data (warm start).
        
        Args:
            X_train: Training features (n_samples, n_features)
            y_train: Training labels (n_samples,)
            
        Returns:
            Dict containing:
                - status: Success/failure status
                - samples_trained: Number of samples used for training
                - initial_metrics: Initial model performance metrics
        """
        pass
    
    @abstractmethod
    def query_samples(self, X_unlabeled: np.ndarray, n_samples: int) -> List[int]:
        """
        Select most informative samples to label.
        
        Args:
            X_unlabeled: Unlabeled data pool (n_samples, n_features)
            n_samples: Number of samples to select
            
        Returns:
            List of indices of selected samples
        """
        pass
    
    @abstractmethod
    def update_model(self, X_new: np.ndarray, y_new: np.ndarray) -> Dict[str, Any]:
        """
        Update model with new labeled samples.
        
        Args:
            X_new: New training features (n_samples, n_features)
            y_new: New training labels (n_samples,)
            
        Returns:
            Dict containing:
                - status: Success/failure status
                - samples_added: Number of samples added
                - metrics_before: Performance before update
                - metrics_after: Performance after update
        """
        pass
    
    @abstractmethod
    def predict(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict labels and uncertainties for given samples.
        
        Args:
            X: Features to predict (n_samples, n_features)
            
        Returns:
            Tuple of (predictions, uncertainties)
        """
        pass
    
    @abstractmethod
    def get_metrics(self) -> ModelMetrics:
        """
        Get current model performance metrics.
        
        Returns:
            ModelMetrics object with current performance
        """
        pass
    
    @abstractmethod
    def get_state(self) -> Dict[str, Any]:
        """
        Get current framework state for serialization.
        
        Returns:
            Dict containing framework state
        """
        pass
    
    @abstractmethod
    def load_state(self, state: Dict[str, Any]) -> None:
        """
        Load framework state from serialized data.
        
        Args:
            state: Previously saved framework state
        """
        pass

class ModelPlugin(ABC):
    """
    Base interface for model plugins.
    
    This interface allows different ML models to be plugged into
    the AL framework (scikit-learn, PyTorch, TensorFlow, etc.).
    """
    
    @abstractmethod
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'ModelPlugin':
        """
        Train the model on given data.
        
        Args:
            X: Training features
            y: Training labels
            
        Returns:
            Self for method chaining
        """
        pass
    
    @abstractmethod
    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Predict labels for given features.
        
        Args:
            X: Features to predict
            
        Returns:
            Predicted labels
        """
        pass
    
    @abstractmethod
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Predict class probabilities for given features.
        
        Args:
            X: Features to predict
            
        Returns:
            Class probabilities (n_samples, n_classes)
        """
        pass
    
    @abstractmethod
    def score(self, X: np.ndarray, y: np.ndarray) -> float:
        """
        Calculate model score on given data.
        
        Args:
            X: Test features
            y: True labels
            
        Returns:
            Model score (typically accuracy)
        """
        pass
    
    @abstractmethod
    def get_params(self) -> Dict[str, Any]:
        """
        Get model parameters.
        
        Returns:
            Dict of model parameters
        """
        pass
    
    @abstractmethod
    def set_params(self, **params) -> 'ModelPlugin':
        """
        Set model parameters.
        
        Args:
            **params: Parameters to set
            
        Returns:
            Self for method chaining
        """
        pass

class QueryStrategyPlugin(ABC):
    """
    Base interface for query strategy plugins.
    
    This interface allows different query strategies to be plugged in
    (uncertainty sampling, diversity sampling, hybrid approaches, etc.).
    """
    
    @abstractmethod
    def select_samples(self, model: ModelPlugin, X_unlabeled: np.ndarray, 
                      n_samples: int, **kwargs) -> List[int]:
        """
        Select most informative samples for labeling.
        
        Args:
            model: Trained model to use for selection
            X_unlabeled: Pool of unlabeled samples
            n_samples: Number of samples to select
            **kwargs: Strategy-specific parameters
            
        Returns:
            List of indices of selected samples
        """
        pass
    
    @abstractmethod
    def get_strategy_info(self) -> Dict[str, Any]:
        """
        Get information about the query strategy.
        
        Returns:
            Dict containing strategy metadata
        """
        pass

class DatasetPlugin(ABC):
    """
    Base interface for dataset plugins.
    
    This interface allows different datasets to be plugged in
    with consistent loading and preprocessing.
    """
    
    @abstractmethod
    def load_data(self) -> Tuple[np.ndarray, np.ndarray]:
        """
        Load the complete dataset.
        
        Returns:
            Tuple of (features, labels)
        """
        pass
    
    @abstractmethod
    def get_initial_training_data(self, n_samples: int) -> Tuple[np.ndarray, np.ndarray]:
        """
        Get initial training data for warm start.
        
        Args:
            n_samples: Number of samples for initial training
            
        Returns:
            Tuple of (features, labels) for initial training
        """
        pass
    
    @abstractmethod
    def generate_synthetic(self, n_samples: int) -> np.ndarray:
        """
        Generate synthetic unlabeled samples.
        
        Args:
            n_samples: Number of synthetic samples to generate
            
        Returns:
            Synthetic features (n_samples, n_features)
        """
        pass
    
    @abstractmethod
    def get_sample_info(self, index: int) -> SampleInfo:
        """
        Get detailed information about a specific sample.
        
        Args:
            index: Sample index
            
        Returns:
            SampleInfo object with sample details
        """
        pass
    
    @abstractmethod
    def get_dataset_info(self) -> Dict[str, Any]:
        """
        Get information about the dataset.
        
        Returns:
            Dict containing dataset metadata
        """
        pass

class PreprocessorPlugin(ABC):
    """
    Base interface for data preprocessing plugins.
    
    This interface allows different preprocessing steps to be chained
    (scaling, normalization, feature selection, etc.).
    """
    
    @abstractmethod
    def fit(self, X: np.ndarray) -> 'PreprocessorPlugin':
        """
        Fit the preprocessor on training data.
        
        Args:
            X: Training features
            
        Returns:
            Self for method chaining
        """
        pass
    
    @abstractmethod
    def transform(self, X: np.ndarray) -> np.ndarray:
        """
        Transform features using fitted preprocessor.
        
        Args:
            X: Features to transform
            
        Returns:
            Transformed features
        """
        pass
    
    @abstractmethod
    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        """
        Fit preprocessor and transform features in one step.
        
        Args:
            X: Features to fit and transform
            
        Returns:
            Transformed features
        """
        pass
    
    @abstractmethod
    def inverse_transform(self, X: np.ndarray) -> np.ndarray:
        """
        Inverse transform features (if applicable).
        
        Args:
            X: Transformed features
            
        Returns:
            Original features
        """
        pass 