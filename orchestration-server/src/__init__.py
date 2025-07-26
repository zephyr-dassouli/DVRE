def _jupyter_server_extension_points():
    return [{
        "module": "dvre_orchestration_server"
    }]

def _load_jupyter_server_extension(server_app):
    """Load the DVRE orchestration server extension"""
    print("Loading DVRE orchestration server extension...")
    try:
        from .streamflow_handler import setup_handlers
        setup_handlers(server_app.web_app)
        print("DVRE orchestration server handlers registered successfully")
        server_app.log.info("DVRE Orchestration Server extension loaded.")
    except Exception as e:
        print(f"Error loading DVRE orchestration server extension: {e}")
        server_app.log.error(f"Failed to load DVRE Orchestration Server extension: {e}")
        raise

# Alias for different Jupyter versions
load_jupyter_server_extension = _load_jupyter_server_extension