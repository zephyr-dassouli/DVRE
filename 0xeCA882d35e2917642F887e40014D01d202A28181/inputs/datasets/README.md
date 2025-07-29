# AL-Engine Dataset Instructions

## Available Datasets


### Training Dataset
- **Type**: general
- **Format**: csv
- **IPFS Hash**: `undefined`
- **Download URL**: `http://dvre03.lab.uvalight.net:8081/ipfs/ipfs/undefined`

### iris-training-dataset
- **Type**: training
- **Format**: csv
- **IPFS Hash**: `Qmc2ZUDQfhpcAqTUebdC2RuozVyqPRbZAZ2LPetmjvbFtn`
- **Download URL**: `http://dvre03.lab.uvalight.net:8081/ipfs/ipfs/Qmc2ZUDQfhpcAqTUebdC2RuozVyqPRbZAZ2LPetmjvbFtn`

### iris-labeling-dataset
- **Type**: labeling
- **Format**: csv
- **IPFS Hash**: `QmUja7AzRR3yVEvEYdZqAZqDmgAmNe27U4pvhViTzwnV14`
- **Download URL**: `http://dvre03.lab.uvalight.net:8081/ipfs/ipfs/QmUja7AzRR3yVEvEYdZqAZqDmgAmNe27U4pvhViTzwnV14`


## For Local AL-Engine Execution

When running AL-Engine locally, these datasets will be automatically downloaded to:
- Training data: `inputs/datasets/labeled_samples.csv`
- Labeling data: `inputs/datasets/unlabeled_samples.csv`

The dataset download is handled by the DVRE local file download service during project deployment.

## Manual Download (if needed)

If you need to download datasets manually:

```bash
# Download training dataset
curl -o inputs/datasets/labeled_samples.csv "http://dvre03.lab.uvalight.net:8081/ipfs/ipfs/Qmc2ZUDQfhpcAqTUebdC2RuozVyqPRbZAZ2LPetmjvbFtn"

# Download labeling dataset  
curl -o inputs/datasets/unlabeled_samples.csv "http://dvre03.lab.uvalight.net:8081/ipfs/ipfs/QmUja7AzRR3yVEvEYdZqAZqDmgAmNe27U4pvhViTzwnV14"
```
