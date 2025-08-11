# AL-Engine Class Imbalance Handling

This document explains how the Active Learning Engine handles class imbalance scenarios, which are common in real-world datasets and active learning workflows.

## Overview

Class imbalance occurs when some classes have significantly fewer samples than others. This is particularly challenging in active learning because:

1. **Small initial labeled datasets** may not represent all classes
2. **Train/test splits** may exclude entire classes from evaluation sets
3. **Active learning querying** may preferentially select samples from certain classes
4. **Performance metrics** require different averaging strategies for balanced vs imbalanced datasets

## Class Imbalance Scenarios

### 1. Initial Dataset Imbalance

**Scenario**: The initial labeled dataset has unequal class distribution.

```
Initial labeled samples:
- Class "0": 7 samples
- Class "1": 2 samples  
- Class "2": 1 sample
```

**AL-Engine Handling**:
- Uses **stratified sampling** in train/test splits when possible
- Falls back to **unstratified sampling** if stratification fails (insufficient samples per class)
- Implements **adaptive test set sizing** for small datasets

```python
try:
    X_train, X_test, y_train, y_test = train_test_split(
        X_labeled, y_labeled, test_size=test_size, 
        random_state=42, stratify=y_labeled  # Maintains class proportions
    )
except ValueError:
    # Fallback for extreme imbalance
    X_train, X_test, y_train, y_test = train_test_split(
        X_labeled, y_labeled, test_size=test_size, random_state=42
    )
```

### 2. Test Set Class Exclusion

**Scenario**: Small test sets may not contain all classes from the label space.

```
Label space: ["0", "1", "2"]  (3 classes)
Test set:    [0, 1]           (2 classes)
```

**Problem**: Using `len(unique(y_test))` would incorrectly classify this as binary.

**AL-Engine Solution**:
```python
# Use full label space from config, not just test set classes
label_space = config.get('label_space', list(np.unique(y_test)))
num_classes = len(label_space)
average_strategy = 'weighted' if num_classes > 2 else 'binary'
```

**Benefits**:
- Prevents `"Target is multiclass but average='binary'"` errors
- Ensures consistent evaluation strategy across iterations
- Handles missing classes gracefully

### 3. Active Learning Query Bias

**Scenario**: Uncertainty sampling may favor uncertain classes, creating imbalance.

**AL-Engine Mitigation**:
- Uses **uncertainty sampling** with confidence-based querying
- Tracks **cumulative class distribution** across iterations
- Provides **sample accumulation logs** for monitoring

```python
# Query samples using uncertainty sampling
if hasattr(self.estimator, 'predict_proba'):
    probabilities = self.estimator.predict_proba(X_unlabeled)
    uncertainties = 1 - np.max(probabilities, axis=1)  # Higher = more uncertain
else:
    uncertainties = np.random.random(len(X_unlabeled))  # Fallback to random

query_indices = np.argsort(uncertainties)[-n_instances:]
```

### 4. Cumulative Learning Imbalance

**Scenario**: As iterations progress, some classes may accumulate more samples than others.

**AL-Engine Monitoring**:
```python
print(f"[SUCCESS] Added sample {original_index} with label {final_label}")
print(f"Updated labeled dataset: {original_count} → {len(updated_labeled_df)} samples")
```

**Tracking Features**:
- Logs newly added samples per iteration
- Tracks original vs updated sample counts
- Provides class distribution summaries

## Performance Evaluation Strategies

### Averaging Methods

The AL-Engine automatically selects appropriate averaging strategies:

| Dataset Type | Classes | Averaging Strategy | Use Case |
|--------------|---------|-------------------|----------|
| Binary | 2 | `binary` | Balanced/imbalanced binary classification |
| Multiclass | 3+ | `weighted` | Handles class imbalance automatically |

### Weighted Averaging Benefits

For imbalanced datasets, `weighted` averaging:
- **Accounts for class frequencies** in the test set
- **Prevents dominant class bias** in metrics
- **Provides fair evaluation** across all classes

```python
precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
```

## Small Dataset Adaptations

### Adaptive Test Set Sizing

For datasets with severe class imbalance:

```python
if len(X_labeled) > 10:
    # Standard 80/20 split
    test_size = 0.2
elif len(X_labeled) >= 6:
    # Adaptive sizing: 30% for test, minimum 2 samples
    test_size = max(2, int(len(X_labeled) * 0.3))
else:
    # Very small datasets: use all data for train/test (with warning)
    X_train, X_test = X_labeled, X_labeled
    y_train, y_test = y_labeled, y_labeled
```

### Warning System

The AL-Engine provides warnings for problematic scenarios:

```
WARNING: Very small dataset (5 samples) - using all data for both training and testing
Performance metrics may be overly optimistic due to train/test data overlap
```

## Sample Accumulation with Imbalance

### Voting Results Processing

The AL-Engine handles imbalanced voting results:

```python
# Process voting results from all previous iterations
for prev_iteration in range(1, iteration_number):
    # Load voting results and query samples
    # Cross-reference to fix frontend mapping issues
    # Add unique samples to training set
    # Track class distribution changes
```

### Duplicate Detection

Prevents duplicate samples from skewing class balance:

```python
# Filter out duplicates by comparing feature values
for new_sample in newly_labeled_samples:
    is_duplicate = False
    new_features = {k: v for k, v in new_sample.items() if k != 'label'}
    
    for existing_sample in existing_samples:
        existing_features = {k: v for k, v in existing_sample.items() if k != 'label'}
        if new_features == existing_features:
            is_duplicate = True
            break
    
    if not is_duplicate:
        truly_new_samples.append(new_sample)
```

## Error Handling and Recovery

### Common Class Imbalance Errors

1. **"Target is multiclass but average='binary'"**
   - **Cause**: Test set missing classes from label space
   - **Solution**: Use config label space instead of test set classes

2. **"0 training samples" in frontend**
   - **Cause**: Training failure due to evaluation errors
   - **Solution**: Robust error handling and fallback strategies

3. **Stratification failures**
   - **Cause**: Insufficient samples per class for stratified splitting
   - **Solution**: Graceful fallback to unstratified splitting

### Recovery Mechanisms

```python
try:
    # Attempt stratified split
    X_train, X_test, y_train, y_test = train_test_split(
        X_labeled, y_labeled, stratify=y_labeled
    )
except ValueError:
    # Fallback for class imbalance
    X_train, X_test, y_train, y_test = train_test_split(
        X_labeled, y_labeled
    )
    print("Small dataset split (unstratified): using non-stratified approach")
```

## Best Practices

### 1. Configuration Setup

Ensure `config.json` includes complete label space:

```json
{
  "label_space": ["0", "1", "2"],
  "query_batch_size": 2,
  "model_type": "RandomForestClassifier"
}
```

### 2. Monitoring Class Distribution

Review iteration logs for class accumulation patterns:

```
[SUCCESS] Added sample 94 with label 1
[SUCCESS] Added sample 134 with label 2
Updated labeled dataset: 18 → 20 samples
```

### 3. Performance Interpretation

Consider class imbalance when interpreting metrics:
- **Accuracy**: May be misleading with severe imbalance
- **F1-Score (weighted)**: Better indicator for imbalanced datasets
- **Training samples count**: Track growth across iterations

## Future Enhancements

Potential improvements for class imbalance handling:

1. **Balanced sampling strategies** (e.g., SMOTE-like techniques)
2. **Class-aware uncertainty sampling** to ensure balanced querying
3. **Dynamic test set composition** to maintain class representation
4. **Per-class performance tracking** across iterations

## Troubleshooting

### Debugging Class Imbalance Issues

1. **Check label space configuration**:
   ```bash
   cat ro-crates/{project_id}/config.json | grep label_space
   ```

2. **Monitor iteration logs** for class distribution:
   ```bash
   python src/al_iteration.py --iteration 2 --project_id {id} | grep "Label space"
   ```

3. **Verify voting results format**:
   ```bash
   cat ro-crates/{project_id}/outputs/voting_results_round_1.json
   ```

4. **Check sample accumulation**:
   ```bash
   ls -la ro-crates/{project_id}/inputs/datasets/labeled_samples*.csv
   ```

## Conclusion

The AL-Engine's class imbalance handling provides:

- **Robust evaluation** with appropriate averaging strategies
- **Adaptive splitting** for small and imbalanced datasets  
- **Graceful error recovery** with informative warnings
- **Comprehensive logging** for monitoring class distribution
- **Cumulative learning** that respects class balance over time

This ensures reliable active learning performance across diverse dataset characteristics and class distribution scenarios. 