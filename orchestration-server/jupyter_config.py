# jupyter_config.py - Jupyter server configuration for CORS

c = get_config()

# CORS Configuration
c.ServerApp.allow_origin = '*'
c.ServerApp.allow_credentials = True
c.ServerApp.disable_check_xsrf = True

# Network Configuration
c.ServerApp.ip = '0.0.0.0'
c.ServerApp.port = 8888
c.ServerApp.allow_root = True

# Security Configuration
c.ServerApp.token = 'dvre-orchestrator-token'
c.ServerApp.password = ''

# Extension Configuration
c.ServerApp.jpserver_extensions = {
    'dvre_orchestration_server': True
}

# Headers Configuration
c.ServerApp.tornado_settings = {
    'headers': {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '3600'
    }
}

# Logging
c.ServerApp.log_level = 'DEBUG' 