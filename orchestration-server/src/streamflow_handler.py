"""
DVRE Orchestration Server - Modular Streamflow Handler
Refactored for improved readability and DAL workflow support

This file coordinates all the modular handlers:
- base_handlers: Authentication decorators and base classes
- dal_templates: DAL workflow templates and management
- workflow_handlers: Workflow submission and execution
- al_engine_handlers: Active Learning engine commands  
- monitoring_handlers: Status, monitoring and statistics
- multi_user_handlers: Multi-user management endpoints
- storage: Centralized data storage
"""

from jupyter_server.utils import url_path_join

# Import all modular handlers
from .workflow_handlers import (
    StreamflowSubmitHandler,
    StreamflowSubmitProjectWorkflowHandler,
    DALTemplateInfoHandler
)

from .al_engine_handlers import (
    ALEngineCommandHandler
)

from .monitoring_handlers import (
    StreamflowStatusHandler,
    ALEngineSessionsListHandler,
    ALEngineSessionsHandler,
    ALEngineSessionDetailHandler,
    StreamflowListWorkflowsHandler,
    StreamflowProjectWorkflowsHandler,
    DatabaseStatsHandler,
    StreamflowHomeHandler
)

from .multi_user_handlers import (
    UserAuthenticationHandler,
    ProjectInfoHandler,
    UserProjectsHandler,
    AssignSamplesHandler,
    SubmitLabelsHandler,
    MultiUserSessionStatsHandler
)


def setup_handlers(web_app):
    """
    Setup all streamflow handlers with enhanced DAL support
    Modular routing for better maintainability
    """
    host_pattern = ".*$"
    base_url = web_app.settings.get("base_url", "/")
    
    # ============================================================================
    # Phase 1: Configuration & Setup Endpoints
    # ============================================================================
    submit_route_pattern = url_path_join(base_url, "streamflow", "submit")
    submit_project_route_pattern = url_path_join(base_url, "streamflow", "submit-project-workflow")
    status_route_pattern = url_path_join(base_url, "streamflow", "status", "([^/]+)")
    list_workflows_route_pattern = url_path_join(base_url, "streamflow", "workflows")
    project_workflows_route_pattern = url_path_join(base_url, "streamflow", "projects", "([^/]+)", "workflows")
    
    # DAL Template Endpoints
    dal_templates_route_pattern = url_path_join(base_url, "dal", "templates")
    
    # ============================================================================
    # Phase 2: Runtime Orchestration Endpoints  
    # ============================================================================
    al_command_route_pattern = url_path_join(base_url, "al-engine", "command")
    al_sessions_list_route_pattern = url_path_join(base_url, "al-engine", "sessions")
    al_sessions_route_pattern = url_path_join(base_url, "al-engine", "sessions", "([^/]+)")
    al_session_detail_route_pattern = url_path_join(base_url, "al-engine", "sessions", "([^/]+)", "([^/]+)")
    
    # ============================================================================
    # Multi-User Management Endpoints
    # ============================================================================
    authenticate_route_pattern = url_path_join(base_url, "users", "authenticate")
    project_info_route_pattern = url_path_join(base_url, "users", "project-info", "([^/]+)")
    my_projects_route_pattern = url_path_join(base_url, "users", "my-projects")
    assign_samples_route_pattern = url_path_join(base_url, "al-engine", "assign-samples")
    submit_labels_route_pattern = url_path_join(base_url, "al-engine", "submit-labels")
    session_stats_route_pattern = url_path_join(base_url, "al-engine", "session-stats", "([^/]+)")
    
    # ============================================================================
    # Monitoring & Statistics Endpoints
    # ============================================================================
    home_route_pattern = url_path_join(base_url, "")
    database_stats_route_pattern = url_path_join(base_url, "database", "stats")
    
    print(f"🚀 Registering DVRE Orchestration Server (Modular + DAL Enhanced):")
    print(f"📁 Phase 1 - Configuration:")
    print(f"  ├── Submit Basic: {submit_route_pattern}")
    print(f"  ├── Submit Project: {submit_project_route_pattern}")
    print(f"  ├── DAL Templates: {dal_templates_route_pattern}")
    print(f"  └── Status: {status_route_pattern}")
    
    print(f"⚡ Phase 2 - Runtime Orchestration:")
    print(f"  ├── AL Command: {al_command_route_pattern}")
    print(f"  ├── Sessions List: {al_sessions_list_route_pattern}")
    print(f"  ├── Project Sessions: {al_sessions_route_pattern}")
    print(f"  └── Session Detail: {al_session_detail_route_pattern}")
    
    print(f"👥 Multi-User Management:")
    print(f"  ├── Authenticate: {authenticate_route_pattern}")
    print(f"  ├── Project Info: {project_info_route_pattern}")
    print(f"  ├── My Projects: {my_projects_route_pattern}")
    print(f"  ├── Assign Samples: {assign_samples_route_pattern}")
    print(f"  ├── Submit Labels: {submit_labels_route_pattern}")
    print(f"  └── Session Stats: {session_stats_route_pattern}")
    
    print(f"📊 Monitoring & Stats:")
    print(f"  ├── Home: {home_route_pattern}")
    print(f"  ├── Workflows: {list_workflows_route_pattern}")
    print(f"  ├── Project Workflows: {project_workflows_route_pattern}")
    print(f"  └── Database Stats: {database_stats_route_pattern}")
    
    handlers = [
        # Phase 1: Configuration & Setup
        (submit_route_pattern, StreamflowSubmitHandler),
        (submit_project_route_pattern, StreamflowSubmitProjectWorkflowHandler),
        (dal_templates_route_pattern, DALTemplateInfoHandler),
        (status_route_pattern, StreamflowStatusHandler),
        (list_workflows_route_pattern, StreamflowListWorkflowsHandler),
        (project_workflows_route_pattern, StreamflowProjectWorkflowsHandler),
        
        # Phase 2: Runtime Orchestration
        (al_command_route_pattern, ALEngineCommandHandler),
        (al_sessions_list_route_pattern, ALEngineSessionsListHandler),
        (al_sessions_route_pattern, ALEngineSessionsHandler),
        (al_session_detail_route_pattern, ALEngineSessionDetailHandler),
        
        # Multi-User Management
        (authenticate_route_pattern, UserAuthenticationHandler),
        (project_info_route_pattern, ProjectInfoHandler),
        (my_projects_route_pattern, UserProjectsHandler),
        (assign_samples_route_pattern, AssignSamplesHandler),
        (submit_labels_route_pattern, SubmitLabelsHandler),
        (session_stats_route_pattern, MultiUserSessionStatsHandler),
        
        # Monitoring & Statistics
        (home_route_pattern, StreamflowHomeHandler),
        (database_stats_route_pattern, DatabaseStatsHandler),
    ]
    
    try:
        web_app.add_handlers(host_pattern, handlers)
        print("✅ DVRE Orchestration Server (Modular + DAL) handlers registered successfully!")
        print(f"📈 Total endpoints: {len(handlers)}")
        print(f"🎯 DAL Templates: Enabled")
        print(f"👥 Multi-User: Coordinator + Contributor roles")
        print(f"📊 Enhanced Monitoring: Enabled")
        
    except Exception as e:
        print(f"❌ Error adding handlers: {e}")
        raise


# For backwards compatibility - export the setup function
__all__ = ['setup_handlers']


def get_handler_info():
    """Get information about all registered handlers"""
    return {
        "total_handlers": 18,
        "modules": {
            "workflow_handlers": ["StreamflowSubmitHandler", "StreamflowSubmitProjectWorkflowHandler", "DALTemplateInfoHandler"],
            "al_engine_handlers": ["ALEngineCommandHandler"],
            "monitoring_handlers": ["StreamflowStatusHandler", "ALEngineSessionsListHandler", "ALEngineSessionsHandler", "ALEngineSessionDetailHandler", "StreamflowListWorkflowsHandler", "StreamflowProjectWorkflowsHandler", "DatabaseStatsHandler", "StreamflowHomeHandler"],
            "multi_user_handlers": ["UserAuthenticationHandler", "ProjectInfoHandler", "UserProjectsHandler", "AssignSamplesHandler", "SubmitLabelsHandler", "MultiUserSessionStatsHandler"]
        },
        "features": {
            "dal_templates": True,
            "multi_user_auth": True,
            "enhanced_monitoring": True,
            "role_based_access": True,
            "modular_architecture": True
        },
        "supported_workflows": {
            "standard_cwl": True,
            "dal_train_query": True,
            "dal_modal_run": True
        }
    } 