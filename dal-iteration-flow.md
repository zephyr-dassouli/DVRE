# DAL Project Iteration

1. DAL: In Control panel, coordinator presses ‘start next iteration’. This simply starts the next round by prompting the AL-Engine.
2. AL Iteration is triggered and the following happens:
    1. AL-Engine: based on `config.json` in `al-engine/ro-crates/<project-address>/` params (model, training params, validation split), the model gets trained on the initial training dataset (in `al-engine/ro-crates/<project-address>/<training-dataset-name>`
    2. AL-Engine: updated model gets stored in `al-engine/ro-crates/<project-address>/config/model/`
    3. AL-Engine: based on `config.json` in `al-engine/ro-crates/<project-address>/` params (al_scenario, query_strategy, label_space, query_batch_size)
    4. DAL: In Labeling panel, the sample is shown and user can vote until timeout, then next sample appears (the refresh button implemented is useful here)
    5. Smart Contract: the ALProjectVoting smart contract handles voting and determines the final labels
    6. After voting is done for the current AL iteration, 
        - For Coordinator: the Labeling panel says ‘Current AL iteration is done, you may start the next iteration or end the project in Control Panel’
        - For Contributor: the Labeling panel says ‘Current AL iteration is done, wait for project Coordinator to start a new round’
        - Smart Contract: JSONProject prompts ALProjectVoting and ALProjectStorage to aggregate results and store the latest labeled samples
        - DAL: calls a getter smart contract function to fetch all the labeled samples
        - AL-Engine: the labeled samples get added to the training set
    
    h. wait for coordinator to press next iteration again.
    
3. DAL: When the project ends by any of the 3 conditions (coordinator presses End, samples run out, max iteration is reached), dal prompts the coordinator to approve saving the RO-Crate from al-engine to IPFS and returns an IPFS hash