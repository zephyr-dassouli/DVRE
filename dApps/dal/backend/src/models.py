"""
Pydantic models for DAL Backend API
"""

from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from enum import Enum

from pydantic import BaseModel, Field, validator


class WorkflowType(str, Enum):
    """Available workflow types"""
    ACTIVE_LEARNING = "active_learning"
    UNCERTAINTY_SAMPLING = "uncertainty_sampling"
    ENTROPY_SAMPLING = "entropy_sampling"
    RANDOM_SAMPLING = "random_sampling"


class ProjectPhase(str, Enum):
    """Project workflow phases"""
    NOT_STARTED = "not_started"
    INITIALIZING = "initializing"
    RUNNING = "running"
    WAITING_FOR_LABELS = "waiting_for_labels"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class ALStrategy(str, Enum):
    """Active Learning strategies"""
    UNCERTAINTY = "uncertainty"
    ENTROPY = "entropy"
    RANDOM = "random"
    MARGIN = "margin"
    LEAST_CONFIDENCE = "least_confidence"


class WorkflowConfig(BaseModel):
    """Configuration for Active Learning workflow"""
    strategy: ALStrategy = ALStrategy.UNCERTAINTY
    n_queries: int = Field(default=10, ge=1, le=1000)
    n_iterations: int = Field(default=5, ge=1, le=50)
    confidence_threshold: float = Field(default=0.8, ge=0.0, le=1.0)
    batch_size: int = Field(default=32, ge=1, le=512)
    model_type: str = Field(default="random_forest")
    
    # Dataset configuration
    dataset_url: Optional[str] = None
    dataset_path: Optional[str] = None
    test_split: float = Field(default=0.2, ge=0.1, le=0.5)
    
    # Training configuration
    max_epochs: int = Field(default=100, ge=1, le=1000)
    learning_rate: float = Field(default=0.001, gt=0.0, le=1.0)
    early_stopping: bool = True
    
    @validator('n_queries')
    def validate_n_queries(cls, v, values):
        if 'n_iterations' in values and v * values['n_iterations'] > 10000:
            raise ValueError('Total queries (n_queries * n_iterations) cannot exceed 10000')
        return v


class WorkflowRequest(BaseModel):
    """Request to start a workflow"""
    workflow_type: WorkflowType
    workflow_config: WorkflowConfig
    project_metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        schema_extra = {
            "example": {
                "workflow_type": "active_learning",
                "workflow_config": {
                    "strategy": "uncertainty",
                    "n_queries": 20,
                    "n_iterations": 3,
                    "model_type": "random_forest",
                    "dataset_url": "https://example.com/dataset.csv"
                },
                "project_metadata": {
                    "description": "Medical image classification project",
                    "tags": ["medical", "classification"]
                }
            }
        }


class QuerySample(BaseModel):
    """A sample queried for labeling"""
    sample_id: str
    features: List[float]
    uncertainty_score: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class LabeledSample(BaseModel):
    """A labeled sample"""
    sample_id: str
    label: Union[str, int, float]
    confidence: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class LabelSubmission(BaseModel):
    """User submission of labels for queried samples"""
    labels: List[LabeledSample]
    batch_id: Optional[str] = None
    user_id: Optional[str] = None
    notes: Optional[str] = None
    
    @validator('labels')
    def validate_labels_not_empty(cls, v):
        if not v:
            raise ValueError('Labels list cannot be empty')
        return v


class TrainingResult(BaseModel):
    """Result of a training iteration"""
    iteration: int
    accuracy: float
    loss: float
    model_path: str
    metrics: Dict[str, float]
    timestamp: datetime = Field(default_factory=datetime.now)


class QueryResult(BaseModel):
    """Result of query selection"""
    queries: List[QuerySample]
    strategy_used: ALStrategy
    total_unlabeled: int
    selection_time: float
    timestamp: datetime = Field(default_factory=datetime.now)


class ProjectStatus(BaseModel):
    """Current status of a project"""
    project_id: str
    phase: ProjectPhase
    current_step: str
    progress: int = Field(ge=0, le=100)
    
    # Results and data
    results: List[Union[TrainingResult, QueryResult]] = []
    current_queries: List[QuerySample] = []
    
    # Metadata
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    updated_at: Optional[datetime] = Field(default_factory=datetime.now)
    estimated_completion: Optional[datetime] = None
    
    # Workflow configuration
    workflow_config: Optional[WorkflowConfig] = None
    
    class Config:
        schema_extra = {
            "example": {
                "project_id": "proj_12345",
                "phase": "running",
                "current_step": "query_selection",
                "progress": 60,
                "results": [],
                "current_queries": [],
                "error": None,
                "started_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-01-15T11:15:00Z"
            }
        }


class BlockchainTransaction(BaseModel):
    """Blockchain transaction details"""
    transaction_hash: str
    block_number: Optional[int] = None
    contract_address: str
    gas_used: Optional[int] = None
    status: str = "pending"
    timestamp: datetime = Field(default_factory=datetime.now)


class WorkflowOutput(BaseModel):
    """Final output of a completed workflow"""
    project_id: str
    workflow_type: WorkflowType
    final_model_path: str
    performance_metrics: Dict[str, float]
    total_iterations: int
    total_queries: int
    blockchain_transactions: List[BlockchainTransaction] = []
    artifacts: Dict[str, str] = {}  # artifact_name -> file_path
    completion_time: datetime = Field(default_factory=datetime.now)


class HealthStatus(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str
    uptime: Optional[float] = None
    dependencies: Optional[Dict[str, bool]] = None 