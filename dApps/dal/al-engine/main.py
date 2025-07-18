"""
AL Engine Service - Main Application

This service handles all active learning logic with a pluggable architecture.
Supports multiple AL frameworks: modAL, ALiPy, custom implementations.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import logging
from typing import Dict, Any, List
import uvicorn

from services.al_engine_service import ALEngineService
from plugin_registry import registry
from interfaces.base import ALFrameworkPlugin

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Request models
class SubmitLabelRequest(BaseModel):
    sample_id: str
    label: int

# Create FastAPI application
app = FastAPI(
    title="AL Engine Service",
    description="""
    Active Learning Engine with Pluggable Architecture
    
    Features:
    - Multiple AL framework support (modAL, ALiPy, custom)
    - Pluggable models, query strategies, and datasets
    - Configuration-based plugin selection
    - Performance tracking and metrics
    """,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
al_service = ALEngineService()

@app.post("/initialize")
def initialize_experiment(config: Dict[str, Any]):
    """Initialize AL experiment with given configuration."""
    try:
        result = al_service.initialize_experiment(config)
        return result
    except Exception as e:
        logger.error(f"Initialization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/next-sample")
def get_next_sample():
    """Get the next most informative sample for labeling."""
    try:
        result = al_service.get_next_sample()
        return result
    except Exception as e:
        logger.error(f"Failed to get next sample: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/submit-label")
def submit_label(request: SubmitLabelRequest):
    """Submit a label for a sample and update the model."""
    try:
        result = al_service.submit_label(request.sample_id, request.label)
        return result
    except Exception as e:
        logger.error(f"Failed to submit label: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
def get_metrics():
    """Get current model performance metrics."""
    try:
        result = al_service.get_metrics()
        return result
    except Exception as e:
        logger.error(f"Failed to get metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status")
def get_status():
    """Get AL engine status and configuration."""
    try:
        result = al_service.get_status()
        return result
    except Exception as e:
        logger.error(f"Failed to get status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reset")
def reset_engine():
    """Reset the AL engine state."""
    try:
        result = al_service.reset()
        return result
    except Exception as e:
        logger.error(f"Failed to reset engine: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/plugins/available")
def list_available_plugins():
    """List all available plugins."""
    try:
        return registry.list_available()
    except Exception as e:
        logger.error(f"Failed to list plugins: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "al-engine"}

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.status_code,
                "message": str(exc.detail),
                "type": "HTTPException"
            }
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": 500,
                "message": "Internal server error",
                "type": type(exc).__name__
            }
        }
    )

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize AL engine on startup."""
    logger.info("Starting AL Engine service...")
    registry.auto_discover_plugins()
    logger.info(f"Discovered plugins: {registry.list_available()}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Shutting down AL Engine service...")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    ) 