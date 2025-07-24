#!/bin/bash

# DVRE DAL Extension - Quick Fix (No Hanging)
# Simple manual approach to fix DAL extension loading

echo "🚀 DVRE DAL Extension Quick Fix"
echo "==============================="

# Enable Corepack first
echo "📦 Enabling Corepack..."
corepack enable

# Manual cleanup (faster than yarn clean)
echo ""
echo "🧹 Manual cleanup..."
rm -rf lib/
rm -rf jupyter_dvre_dal/labextension/
rm -rf node_modules/.cache/
rm -rf .yarn/cache/
rm -rf node_modules/
echo "✅ Cleanup complete"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
yarn install --no-cache

if [ $? -ne 0 ]; then
    echo "❌ Yarn failed, trying npm..."
    npm install
    BUILD_WITH_NPM=true
fi

# Build step by step
echo ""
echo "🔨 Building TypeScript..."
if [ "$BUILD_WITH_NPM" = true ]; then
    npm run build:lib:prod
else
    yarn build:lib:prod
fi

echo ""
echo "🔨 Building JupyterLab extension..."
if [ "$BUILD_WITH_NPM" = true ]; then
    npm run build:labextension
else
    yarn build:labextension
fi

# Check build result
if [ ! -d "jupyter_dvre_dal/labextension" ]; then
    echo "❌ Build failed, trying development build..."
    if [ "$BUILD_WITH_NPM" = true ]; then
        npm run build:labextension:dev
    else
        yarn build:labextension:dev
    fi
fi

if [ ! -d "jupyter_dvre_dal/labextension" ]; then
    echo "❌ All builds failed"
    exit 1
fi

echo "✅ Extension built successfully"

# Python package installation
echo ""
echo "🐍 Installing Python package..."
pip uninstall jupyter-dvre-dal -y 2>/dev/null
pip install -e .

# JupyterLab setup
echo ""
echo "🔧 Setting up JupyterLab..."
jupyter labextension enable jupyter-dvre-dal
jupyter lab clean --all
jupyter lab build --minimize=False

# Verification
echo ""
echo "✅ Quick verification:"
echo "Extension files:"
ls -la jupyter_dvre_dal/labextension/ | head -5

echo ""
echo "🎉 Quick fix complete!"
echo ""
echo "🚀 Start JupyterLab with:"
echo "   jupyter lab --ip=0.0.0.0 --port=8888"
echo ""
echo "💡 If it still doesn't work, try:"
echo "   jupyter lab --log-level=DEBUG" 