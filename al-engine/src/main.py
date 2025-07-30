# main.py - AL-Engine Main Entrypoint (Refactored)

import argparse
import logging
import sys
from server import ALEngineServer
from engine import ALEngine

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="AL-Engine - Active Learning Engine (Local execution only)")
    parser.add_argument('--project_id', type=str, help='Project identifier (required for non-server modes)')
    parser.add_argument('--config', type=str, help='AL configuration file (required for non-server modes)')
    parser.add_argument('--iteration', type=int, help='Run specific iteration (default: run all)')
    parser.add_argument('--workflow', action='store_true', help='Run full workflow')
    parser.add_argument('--service', action='store_true', help='Run in service mode (wait for DAL signals)')
    parser.add_argument('--server', action='store_true', help='Run HTTP API server mode')
    parser.add_argument('--port', type=int, default=5050, help='API server port (default: 5050)')
    
    args = parser.parse_args()
    
    # Validate required arguments for non-server modes
    if not args.server and (not args.project_id or not args.config):
        parser.error("--project_id and --config are required for non-server modes")
    
    try:
        if args.server:
            # Run HTTP API server mode
            logger.info("🚀 Starting AL-Engine in HTTP API server mode...")
            server = ALEngineServer(port=args.port)
            server.start_server()
        else:
            # Initialize legacy AL-Engine
            engine = ALEngine(args.project_id, args.config)
            
            if args.service:
                # Run in service mode - wait for DAL signals
                logger.info("🚀 Starting AL-Engine in file-based service mode...")
                engine.start_service_mode()
            elif args.iteration:
                # Run specific iteration
                result = engine.run_iteration(args.iteration)
                logger.info(f"Iteration {args.iteration} result: {result}")
            elif args.workflow:
                # Run full workflow
                results = engine.run_full_workflow()
                logger.info(f"Workflow completed with {len(results)} iterations")
            else:
                logger.error("Please specify --iteration, --workflow, --service, or --server")
                print("\nUsage examples:")
                print(f"  # HTTP API server mode (recommended):")
                print(f"  python main.py --server --port 5050")
                print(f"  ")
                print(f"  # File-based service mode:")
                print(f"  python main.py --project_id <addr> --config <config.json> --service")
                print(f"  ")
                print(f"  # One-shot execution:")
                print(f"  python main.py --project_id <addr> --config <config.json> --iteration 1")
                sys.exit(1)
            
    except Exception as e:
        logger.error(f"AL-Engine failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 