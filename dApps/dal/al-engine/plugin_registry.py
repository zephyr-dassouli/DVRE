"""
Plugin Registry for AL Engine

This module manages the registration and discovery of all plugins.
It provides a centralized way to register, discover, and instantiate plugins.
"""

import os
import importlib
import inspect
from typing import Dict, List, Type, Any
import logging

from interfaces.base import (
    ALFrameworkPlugin, ModelPlugin, QueryStrategyPlugin, 
    DatasetPlugin, PreprocessorPlugin
)

logger = logging.getLogger(__name__)

class PluginRegistry:
    """
    Central registry for all AL Engine plugins.
    
    This class manages the registration and discovery of plugins,
    providing a unified interface for plugin management.
    """
    
    def __init__(self):
        """Initialize the plugin registry."""
        self.frameworks: Dict[str, Type[ALFrameworkPlugin]] = {}
        self.models: Dict[str, Type[ModelPlugin]] = {}
        self.strategies: Dict[str, Type[QueryStrategyPlugin]] = {}
        self.datasets: Dict[str, Type[DatasetPlugin]] = {}
        self.preprocessors: Dict[str, Type[PreprocessorPlugin]] = {}
        
        # Plugin metadata
        self.plugin_metadata: Dict[str, Dict[str, Any]] = {}
        
        logger.info("Plugin registry initialized")
    
    def register_framework(self, name: str, plugin_class: Type[ALFrameworkPlugin], 
                          metadata: Dict[str, Any] = None):
        """
        Register an AL framework plugin.
        
        Args:
            name: Plugin name (e.g., "modAL", "ALiPy")
            plugin_class: Plugin class implementing ALFrameworkPlugin
            metadata: Optional metadata about the plugin
        """
        if not issubclass(plugin_class, ALFrameworkPlugin):
            raise ValueError(f"Plugin {name} must implement ALFrameworkPlugin")
        
        self.frameworks[name] = plugin_class
        if metadata:
            self.plugin_metadata[f"framework_{name}"] = metadata
        
        logger.info(f"Registered framework plugin: {name}")
    
    def register_model(self, name: str, plugin_class: Type[ModelPlugin], 
                      metadata: Dict[str, Any] = None):
        """
        Register a model plugin.
        
        Args:
            name: Plugin name (e.g., "random_forest", "svm")
            plugin_class: Plugin class implementing ModelPlugin
            metadata: Optional metadata about the plugin
        """
        if not issubclass(plugin_class, ModelPlugin):
            raise ValueError(f"Plugin {name} must implement ModelPlugin")
        
        self.models[name] = plugin_class
        if metadata:
            self.plugin_metadata[f"model_{name}"] = metadata
        
        logger.info(f"Registered model plugin: {name}")
    
    def register_strategy(self, name: str, plugin_class: Type[QueryStrategyPlugin], 
                         metadata: Dict[str, Any] = None):
        """
        Register a query strategy plugin.
        
        Args:
            name: Plugin name (e.g., "uncertainty_sampling", "diversity_sampling")
            plugin_class: Plugin class implementing QueryStrategyPlugin
            metadata: Optional metadata about the plugin
        """
        if not issubclass(plugin_class, QueryStrategyPlugin):
            raise ValueError(f"Plugin {name} must implement QueryStrategyPlugin")
        
        self.strategies[name] = plugin_class
        if metadata:
            self.plugin_metadata[f"strategy_{name}"] = metadata
        
        logger.info(f"Registered strategy plugin: {name}")
    
    def register_dataset(self, name: str, plugin_class: Type[DatasetPlugin], 
                        metadata: Dict[str, Any] = None):
        """
        Register a dataset plugin.
        
        Args:
            name: Plugin name (e.g., "wine", "cifar10")
            plugin_class: Plugin class implementing DatasetPlugin
            metadata: Optional metadata about the plugin
        """
        if not issubclass(plugin_class, DatasetPlugin):
            raise ValueError(f"Plugin {name} must implement DatasetPlugin")
        
        self.datasets[name] = plugin_class
        if metadata:
            self.plugin_metadata[f"dataset_{name}"] = metadata
        
        logger.info(f"Registered dataset plugin: {name}")
    
    def register_preprocessor(self, name: str, plugin_class: Type[PreprocessorPlugin], 
                             metadata: Dict[str, Any] = None):
        """
        Register a preprocessor plugin.
        
        Args:
            name: Plugin name (e.g., "standard_scaler", "pca")
            plugin_class: Plugin class implementing PreprocessorPlugin
            metadata: Optional metadata about the plugin
        """
        if not issubclass(plugin_class, PreprocessorPlugin):
            raise ValueError(f"Plugin {name} must implement PreprocessorPlugin")
        
        self.preprocessors[name] = plugin_class
        if metadata:
            self.plugin_metadata[f"preprocessor_{name}"] = metadata
        
        logger.info(f"Registered preprocessor plugin: {name}")
    
    def get_framework(self, name: str) -> ALFrameworkPlugin:
        """
        Get an instance of a framework plugin.
        
        Args:
            name: Framework plugin name
            
        Returns:
            Instance of the framework plugin
            
        Raises:
            ValueError: If plugin not found
        """
        if name not in self.frameworks:
            raise ValueError(f"Framework plugin '{name}' not found. Available: {list(self.frameworks.keys())}")
        
        return self.frameworks[name]()
    
    def get_model(self, name: str, **kwargs) -> ModelPlugin:
        """
        Get an instance of a model plugin.
        
        Args:
            name: Model plugin name
            **kwargs: Model initialization parameters
            
        Returns:
            Instance of the model plugin
            
        Raises:
            ValueError: If plugin not found
        """
        if name not in self.models:
            raise ValueError(f"Model plugin '{name}' not found. Available: {list(self.models.keys())}")
        
        return self.models[name](**kwargs)
    
    def get_strategy(self, name: str, **kwargs) -> QueryStrategyPlugin:
        """
        Get an instance of a query strategy plugin.
        
        Args:
            name: Strategy plugin name
            **kwargs: Strategy initialization parameters
            
        Returns:
            Instance of the strategy plugin
            
        Raises:
            ValueError: If plugin not found
        """
        if name not in self.strategies:
            raise ValueError(f"Strategy plugin '{name}' not found. Available: {list(self.strategies.keys())}")
        
        return self.strategies[name](**kwargs)
    
    def get_dataset(self, name: str, **kwargs) -> DatasetPlugin:
        """
        Get an instance of a dataset plugin.
        
        Args:
            name: Dataset plugin name
            **kwargs: Dataset initialization parameters
            
        Returns:
            Instance of the dataset plugin
            
        Raises:
            ValueError: If plugin not found
        """
        if name not in self.datasets:
            raise ValueError(f"Dataset plugin '{name}' not found. Available: {list(self.datasets.keys())}")
        
        return self.datasets[name](**kwargs)
    
    def get_preprocessor(self, name: str, **kwargs) -> PreprocessorPlugin:
        """
        Get an instance of a preprocessor plugin.
        
        Args:
            name: Preprocessor plugin name
            **kwargs: Preprocessor initialization parameters
            
        Returns:
            Instance of the preprocessor plugin
            
        Raises:
            ValueError: If plugin not found
        """
        if name not in self.preprocessors:
            raise ValueError(f"Preprocessor plugin '{name}' not found. Available: {list(self.preprocessors.keys())}")
        
        return self.preprocessors[name](**kwargs)
    
    def list_available(self) -> Dict[str, List[str]]:
        """
        List all available plugins.
        
        Returns:
            Dict mapping plugin types to lists of available plugins
        """
        return {
            "frameworks": list(self.frameworks.keys()),
            "models": list(self.models.keys()),
            "strategies": list(self.strategies.keys()),
            "datasets": list(self.datasets.keys()),
            "preprocessors": list(self.preprocessors.keys())
        }
    
    def get_plugin_info(self, plugin_type: str, plugin_name: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific plugin.
        
        Args:
            plugin_type: Type of plugin (framework, model, strategy, dataset, preprocessor)
            plugin_name: Name of the plugin
            
        Returns:
            Dict containing plugin information
        """
        key = f"{plugin_type}_{plugin_name}"
        
        # Get basic info
        info = {
            "name": plugin_name,
            "type": plugin_type,
            "available": False
        }
        
        # Check if plugin exists
        plugin_dict = getattr(self, f"{plugin_type}s", {})
        if plugin_name in plugin_dict:
            info["available"] = True
            info["class"] = plugin_dict[plugin_name].__name__
            info["module"] = plugin_dict[plugin_name].__module__
            
            # Add metadata if available
            if key in self.plugin_metadata:
                info["metadata"] = self.plugin_metadata[key]
        
        return info
    
    def auto_discover_plugins(self, plugin_dir: str = "plugins"):
        """
        Automatically discover and register plugins from the plugins directory.
        
        Args:
            plugin_dir: Directory to search for plugins
        """
        if not os.path.exists(plugin_dir):
            logger.warning(f"Plugin directory {plugin_dir} not found")
            return
        
        logger.info(f"Auto-discovering plugins in {plugin_dir}")
        
        # Discover plugins in each subdirectory
        for plugin_type in ["frameworks", "models", "strategies", "datasets", "preprocessors"]:
            type_dir = os.path.join(plugin_dir, plugin_type)
            if os.path.exists(type_dir):
                self._discover_plugins_in_dir(type_dir, plugin_type)
    
    def _discover_plugins_in_dir(self, directory: str, plugin_type: str):
        """
        Discover plugins in a specific directory.
        
        Args:
            directory: Directory to search
            plugin_type: Type of plugins to discover
        """
        for filename in os.listdir(directory):
            if filename.endswith(".py") and not filename.startswith("__"):
                module_name = filename[:-3]  # Remove .py extension
                
                try:
                    # Import the module
                    module_path = f"plugins.{plugin_type}.{module_name}"
                    module = importlib.import_module(module_path)
                    
                    # Find plugin classes in the module
                    self._register_plugins_from_module(module, plugin_type)
                    
                except Exception as e:
                    logger.error(f"Failed to load plugin module {module_path}: {str(e)}")
    
    def _register_plugins_from_module(self, module, plugin_type: str):
        """
        Register plugins found in a module.
        
        Args:
            module: Python module containing plugins
            plugin_type: Type of plugins to register
        """
        # Map plugin types to their base classes
        base_classes = {
            "frameworks": ALFrameworkPlugin,
            "models": ModelPlugin,
            "strategies": QueryStrategyPlugin,
            "datasets": DatasetPlugin,
            "preprocessors": PreprocessorPlugin
        }
        
        base_class = base_classes.get(plugin_type)
        if not base_class:
            return
        
        # Find all classes that inherit from the base class
        for name, obj in inspect.getmembers(module, inspect.isclass):
            if (issubclass(obj, base_class) and 
                obj != base_class and 
                obj.__module__ == module.__name__):
                
                # Register the plugin
                plugin_name = getattr(obj, 'PLUGIN_NAME', name.lower())
                register_method = getattr(self, f"register_{plugin_type[:-1]}")  # Remove 's' from end
                
                try:
                    register_method(plugin_name, obj)
                except Exception as e:
                    logger.error(f"Failed to register plugin {plugin_name}: {str(e)}")

# Global registry instance
registry = PluginRegistry() 