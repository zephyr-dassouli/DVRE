#!/bin/bash
# run_dal_test.sh - Easy setup and execution of DAL simulation

echo "🌸 DAL Project Simulation Test Runner"
echo "====================================="

PROJECT_ID="0xeCA882d35e2917642F887e40014D01d202A28181"

# Check if we're in the right directory
if [[ ! -f "main.py" ]]; then
    echo "❌ Please run this script from the al-engine directory"
    echo "   cd al-engine && ./run_dal_test.sh"
    exit 1
fi

# Install Python dependencies if needed
echo "📦 Checking Python dependencies..."
pip install pandas numpy requests 2>/dev/null || {
    echo "⚠️  Please install dependencies: pip install pandas numpy requests"
}

# Create project directory structure
echo "📁 Creating project directory structure..."
mkdir -p "ro-crates/$PROJECT_ID/inputs/datasets"
mkdir -p "al_work_$PROJECT_ID"

echo ""
echo "🚀 DAL Simulation Test Instructions:"
echo "1. Start AL-Engine server in one terminal:"
echo "   python main.py --project_id $PROJECT_ID --config ro-crates/$PROJECT_ID/config.json --server"
echo ""
echo "2. Run the DAL simulation in another terminal:"
echo "   python test_dal_simulation.py"
echo ""
echo "📋 The simulation will:"
echo "   ✅ Create realistic flower classification datasets"
echo "   ✅ Test all AL-Engine API endpoints"
echo "   ✅ Simulate 5 complete AL iterations"  
echo "   ✅ Process ~10 labeled samples total"
echo "   ✅ Demonstrate real DAL workflow"
echo ""
echo "🎯 Ready to test? Run the commands above!" 