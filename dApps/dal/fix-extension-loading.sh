#!/bin/bash

# DVRE DAL Extension - Fix Loading Issues
# This script ensures consistent DAL extension loading in JupyterLab

echo "🔧 DVRE DAL Extension Loading Fix"
echo "=================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js not found. Please install Node.js 16+"
    exit 1
fi

if ! command_exists jupyter; then
    echo "❌ Jupyter not found. Please install JupyterLab 4.0+"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Handle Yarn version management
echo ""
echo "🧶 Setting up Yarn..."

# Check if corepack is available and enable it
if command_exists corepack; then
    echo "📦 Enabling Corepack for Yarn 3.5.0..."
    corepack enable
    # This will automatically use the version specified in package.json
    YARN_CMD="yarn"
else
    echo "⚠️  Corepack not available, checking Yarn installation..."
    
    # Check current yarn version
    if command_exists yarn; then
        YARN_VERSION=$(yarn --version)
        echo "Current Yarn version: $YARN_VERSION"
        
        # If using Yarn 1.x, try to use npx to run Yarn 3
        if [[ $YARN_VERSION == 1.* ]]; then
            echo "🔄 Using npx to run Yarn 3 for this project..."
            if command_exists npx; then
                YARN_CMD="npx yarn"
            else
                echo "❌ Yarn 1.x detected but npx not available"
                echo "Please install Yarn 3.x or enable Corepack:"
                echo "  npm install -g corepack && corepack enable"
                echo "  OR"
                echo "  npm install -g yarn@3.5.0"
                exit 1
            fi
        else
            YARN_CMD="yarn"
        fi
    else
        echo "❌ Yarn not found. Installing via npm..."
        npm install -g yarn@3.5.0
        YARN_CMD="yarn"
    fi
fi

echo "✅ Yarn setup complete"

# Clean everything
echo ""
echo "🧹 Cleaning previous builds..."
$YARN_CMD clean:all 2>/dev/null || echo "Clean command not available, manually cleaning..."
rm -rf node_modules/.cache
rm -rf lib/
rm -rf jupyter_dvre_dal/labextension/
rm -rf .yarn/cache/
rm -rf node_modules/

# Reinstall Node.js dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
$YARN_CMD install

if [ $? -ne 0 ]; then
    echo "❌ Yarn install failed. Trying with npm..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Both yarn and npm install failed"
        exit 1
    fi
    # Use npm for build commands
    NPM_FALLBACK=true
    echo "📝 Using npm fallback for build commands"
fi

# Build extension
echo ""
echo "🔨 Building extension..."

if [ "$NPM_FALLBACK" = true ]; then
    # Build with npm scripts
    npm run build:lib:prod
    npm run build:labextension
else
    # Build with yarn
    $YARN_CMD build:prod
fi

# Check if labextension was built
if [ ! -d "jupyter_dvre_dal/labextension" ]; then
    echo "❌ Extension build failed - labextension directory not found"
    echo "Trying alternative build approach..."
    
    # Try building step by step
    if [ "$NPM_FALLBACK" = true ]; then
        npm run build:lib
        npm run build:labextension:dev
    else
        $YARN_CMD build:lib
        $YARN_CMD build:labextension:dev
    fi
    
    if [ ! -d "jupyter_dvre_dal/labextension" ]; then
        echo "❌ Alternative build also failed"
        echo "Please check the build logs above for errors"
        exit 1
    fi
fi

echo "✅ Extension built successfully"

# Uninstall previous Python package
echo ""
echo "🗑️  Uninstalling previous Python package..."
pip uninstall jupyter-dvre-dal -y 2>/dev/null

# Install Python package
echo ""
echo "🐍 Installing Python package..."
pip install -e .

# Enable extension in JupyterLab
echo ""
echo "🔌 Enabling extension in JupyterLab..."
jupyter labextension enable jupyter-dvre-dal

# Clean JupyterLab cache
echo ""
echo "🧽 Cleaning JupyterLab cache..."
jupyter lab clean
jupyter lab build --minimize=False

# Verify installation
echo ""
echo "✅ Verifying installation..."
echo "Extension status:"
jupyter labextension list | grep -E "(jupyter-dvre-dal|dal)" || echo "Extension not found in list (this might be normal for dev installs)"

echo ""
echo "Installed Python packages:"
pip list | grep jupyter-dvre-dal

# Check if extension files exist
echo ""
echo "Extension files:"
if [ -f "jupyter_dvre_dal/labextension/package.json" ]; then
    echo "✅ package.json found"
    echo "   Version: $(cat jupyter_dvre_dal/labextension/package.json | grep '"version"' | head -1)"
else
    echo "❌ package.json missing"
fi

if [ -f "jupyter_dvre_dal/labextension/static/style.js" ]; then
    echo "✅ style.js found"
else
    echo "⚠️  style.js missing (trying alternative locations...)"
    find jupyter_dvre_dal/labextension -name "*.js" | head -3
fi

# Check Python package installation
echo ""
echo "Python package verification:"
python -c "import jupyter_dvre_dal; print(f'✅ Package version: {jupyter_dvre_dal.__version__}')" 2>/dev/null || echo "⚠️  Python package import issue"

# Final instructions
echo ""
echo "🎉 Setup complete!"
echo ""
echo "🚀 To start JupyterLab with DAL extension:"
echo "   jupyter lab --ip=0.0.0.0 --port=8888"
echo ""
echo "🔍 To verify the extension is loaded:"
echo "   1. Open JupyterLab in browser"
echo "   2. Check browser console for DAL extension logs"
echo "   3. Look for 'Two-Phase AL orchestration' in the interface"
echo "   4. Check JupyterLab extensions panel"
echo ""
echo "🐛 If extension still doesn't load:"
echo "   1. Check browser console for errors"
echo "   2. Run: jupyter labextension list --debug"
echo "   3. Try: jupyter lab --log-level=DEBUG"
echo "   4. Restart JupyterLab completely"
echo ""
echo "📚 For more help, see the updated README.md" 