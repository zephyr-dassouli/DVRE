"""
Centralized storage for the orchestration server
In-memory storage for workflow states, AL sessions, and multi-user data
"""

# In-memory storage for workflow states
workflow_db = {}

# In-memory storage for AL engine sessions (Phase 2) - Enhanced for multi-user
al_sessions_db = {}  # project_id -> session_id -> MultiUserSession
al_commands_db = {}

# Multi-user session tracking
multi_user_sessions = {}  # project_id -> MultiUserSession


def get_workflow_stats():
    """Get workflow database statistics"""
    return {
        "total_workflows": len(workflow_db),
        "workflow_statuses": {},
        "dal_workflows": 0,
        "standard_workflows": 0
    }


def get_al_session_stats():
    """Get AL session database statistics"""
    total_sessions = sum(len(sessions) for sessions in al_sessions_db.values())
    return {
        "total_projects": len(al_sessions_db),
        "total_sessions": total_sessions,
        "active_multi_user_sessions": len(multi_user_sessions)
    }


def cleanup_completed_workflows(max_age_hours=24):
    """Clean up old completed workflows (for production usage)"""
    # This would implement cleanup logic for old workflows
    # For now, just return count
    return len([w for w in workflow_db.values() if w.get('status') in ['COMPLETED', 'FAILED']])


def get_database_info():
    """Get comprehensive database information"""
    return {
        "workflow_stats": get_workflow_stats(),
        "al_session_stats": get_al_session_stats(),
        "storage_type": "in_memory",
        "note": "Production deployment should use persistent storage (PostgreSQL, MongoDB, etc.)"
    } 