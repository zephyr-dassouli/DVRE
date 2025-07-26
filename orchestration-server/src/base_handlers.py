import json
import tornado.web
from datetime import datetime
from .multi_user_auth import DVRERequestValidator

def require_authentication(required_permission=None):
    """
    Decorator for endpoints that require user authentication
    Note: Trusts DVRE authentication, validates request format and permissions
    """
    def decorator(handler_method):
        def wrapper(self, *args, **kwargs):
            try:
                # Parse request body to get user authentication data
                if hasattr(self, 'request') and self.request.body:
                    body = json.loads(self.request.body.decode('utf-8'))
                else:
                    body = {}
                
                # Validate request from DVRE (trusts DVRE authentication)
                user_data = DVRERequestValidator.validate_request(body)
                
                # Check permissions if required
                if required_permission:
                    DVRERequestValidator.require_permission(user_data, required_permission)
                
                # Store user data in handler for use in method
                self.user_data = user_data
                
                # Call original handler method
                return handler_method(self, *args, **kwargs)
                
            except ValueError as e:
                self.set_status(400)
                self.write(json.dumps({"error": f"Request validation error: {str(e)}"}))
                return
            except PermissionError as e:
                self.set_status(403)
                self.write(json.dumps({"error": f"Permission denied: {str(e)}"}))
                return
            except Exception as e:
                self.set_status(500)
                self.write(json.dumps({"error": f"Server error: {str(e)}"}))
                return
        
        return wrapper
    return decorator


class BaseStreamflowHandler(tornado.web.RequestHandler):
    """Base handler for all streamflow endpoints with CORS support"""
    
    def set_default_headers(self):
        self.set_header("Content-Type", "application/json")
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma")
        self.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
        self.set_header("Access-Control-Allow-Credentials", "true")
        self.set_header("Access-Control-Max-Age", "3600")
    
    def options(self, *args):
        # Handle preflight requests
        self.set_status(204)
        self.finish()
    
    def check_xsrf_cookie(self):
        # Disable XSRF checking for API handlers
        pass
    
    def prepare(self):
        # Additional XSRF bypass
        pass 