# DAL-AL-Engine Testing Suite

This directory contains comprehensive tests to validate the integration between DAL (Decentralized Active Learning) and AL-Engine. These tests are **critical** for ensuring proper file paths, data formats, and workflow compatibility.

## 🧪 Test Files Overview

### 1. `test_path_validation.py`
**Purpose**: Validates all critical file paths and data formats
- ✅ Input dataset paths (`ro-crates/<project-id>/inputs/datasets/`)
- ✅ Output query sample paths (`al_work_<project-id>/output/query_samples.json`)
- ✅ Configuration file paths and formats
- ✅ CWL workflow file accessibility
- ✅ Cross-platform path compatibility
- ✅ File permissions and read/write access
- ✅ Data serialization/deserialization

### 2. `test_dal_simulation.py`
**Purpose**: Complete DAL project workflow simulation
- 🌸 Realistic flower classification project
- 📊 Multi-iteration active learning (5 iterations)
- 👥 User labeling simulation with 10% noise
- 🔗 Smart contract interaction simulation
- 🔄 Complete query → label → submit workflow

### 3. `test_comprehensive_dal.py`
**Purpose**: Combined path validation + DAL simulation
- 🔍 **Phase 1**: Path validation and setup
- 🌸 **Phase 2**: AL-Engine integration testing
- 📊 **Phase 3**: DAL workflow simulation
- ✅ Complete end-to-end validation

### 4. `test_api.py`
**Purpose**: AL-Engine HTTP API endpoint testing
- 🏥 Health check endpoint
- 🚀 Start iteration endpoint
- 📤 Submit labels endpoint
- 📊 Status and results endpoints

## 🚀 Quick Start

### Prerequisites
```bash
# Install Python dependencies
pip install pandas numpy requests flask flask-cors modAL scikit-learn

# Ensure you're in the al-engine directory
cd al-engine
```

### Option 1: Quick Setup (Recommended)
```bash
# Run the setup script
./run_dal_test.sh

# This will:
# ✅ Check dependencies
# ✅ Create directory structure
# ✅ Show you the commands to run
```

### Option 2: Manual Testing

#### Step 1: Path Validation
```bash
# Validate all file paths are correct
python test_path_validation.py
```

#### Step 2: Start AL-Engine Server
```bash
# Terminal 1: Start AL-Engine in server mode
python main.py --project_id 0xeCA882d35e2917642F887e40014D01d202A28181 --config ro-crates/0xeCA882d35e2917642F887e40014D01d202A28181/config.json --server
```

#### Step 3: Run DAL Simulation
```bash
# Terminal 2: Run complete DAL simulation
python test_dal_simulation.py

# OR run comprehensive test (includes path validation)
python test_comprehensive_dal.py
```

## 📊 Test Results Interpretation

### ✅ All Tests Pass
```
🎉 ALL TESTS PASSED - DAL integration paths are valid!
✅ Ready for DAL integration testing!
```
Your setup is ready for production DAL deployment!

### ❌ Tests Fail
```
❌ X CRITICAL ERRORS found:
   • Dataset file not readable: ro-crates/.../labeled_samples.csv
   • Query samples path validation failed
```
**Action Required**: Fix all critical errors before proceeding with DAL integration.

### ⚠️ Warnings
```
⚠️ X warnings:
   • AL-Engine API not accessible (server not running)
   • File not writable: config.json
```
Warnings indicate potential issues but don't block basic functionality.

## 🔍 Critical Path Validation

The tests validate these **essential** paths for DAL integration:

### Input Paths (DAL → AL-Engine)
```
ro-crates/<project-id>/
├── config.json                    # AL configuration
├── al_iteration.cwl               # CWL workflow
├── inputs.yml                     # CWL inputs
└── inputs/datasets/
    ├── labeled_samples.csv        # Initial training data
    └── unlabeled_samples.csv      # Unlabeled data pool
```

### Output Paths (AL-Engine → DAL)
```
al_work_<project-id>/
└── output/
    ├── query_samples.json         # Samples for labeling (CRITICAL!)
    └── model/
        └── model_round_*.pkl      # Trained models
```

### Data Format Validation

**Query Samples Format** (AL-Engine → DAL):
```json
[
  {
    "sepal_length": 5.1,
    "sepal_width": 3.5,
    "petal_length": 1.4,
    "petal_width": 0.2,
    "original_index": 42
  }
]
```

**Labeled Samples Format** (DAL → AL-Engine):
```json
[
  {
    "sample_id": "sample_1_1_123456",
    "sample_data": {
      "features": [5.1, 3.5, 1.4, 0.2],
      "sepal_length": 5.1,
      "sepal_width": 3.5,
      "petal_length": 1.4,
      "petal_width": 0.2
    },
    "label": "setosa",
    "original_index": 42
  }
]
```

## 🐛 Troubleshooting

### Common Issues

#### 1. "Cannot connect to AL-Engine"
**Solution**: Start the AL-Engine server first:
```bash
python main.py --project_id <PROJECT_ID> --config <CONFIG_PATH> --server
```

#### 2. "Dataset file not readable"
**Solution**: Run path validation to create missing files:
```bash
python test_path_validation.py
```

#### 3. "Query samples file not found"
**Solution**: Check AL-Engine execution:
- Verify `al_iteration.py` exists
- Check CWL workflow files
- Ensure output directory is writable

#### 4. "Data serialization test failed"
**Solution**: Verify JSON compatibility:
- Check Python JSON module
- Validate data structure formats
- Test with simpler data first

### Debug Mode
For detailed debugging, add print statements or use:
```bash
python -u test_comprehensive_dal.py  # Unbuffered output
```

## 📋 Test Coverage

| Component | Path Validation | Format Validation | Integration Test |
|-----------|----------------|-------------------|------------------|
| Input Datasets | ✅ | ✅ | ✅ |
| Config Files | ✅ | ✅ | ✅ |
| CWL Workflows | ✅ | ✅ | ✅ |
| Query Samples | ✅ | ✅ | ✅ |
| Labeled Samples | ✅ | ✅ | ✅ |
| API Endpoints | ✅ | ✅ | ✅ |
| Cross-Platform | ✅ | N/A | ✅ |
| Error Handling | ✅ | ✅ | ✅ |

## 🎯 Production Readiness Checklist

Before deploying DAL in production:

- [ ] ✅ All path validation tests pass
- [ ] ✅ DAL simulation completes successfully  
- [ ] ✅ No critical errors in comprehensive test
- [ ] ✅ AL-Engine API responds correctly
- [ ] ✅ Query samples format is valid
- [ ] ✅ Labeled samples submission works
- [ ] ✅ Multi-iteration workflow functions
- [ ] ✅ Error handling works properly

## 📞 Support

If tests fail or you encounter issues:

1. **Check Prerequisites**: Ensure all Python packages are installed
2. **Run Individual Tests**: Isolate the failing component
3. **Review Error Messages**: Most errors include specific guidance
4. **Validate Environment**: Confirm you're in the correct directory
5. **Check File Permissions**: Ensure read/write access to test directories

---

**Remember**: These tests validate the **critical integration points** between DAL and AL-Engine. All tests must pass before production deployment! 