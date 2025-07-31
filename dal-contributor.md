# DAL Contributor

This document provides the functionalities of the DAL component for the contributor role. The contributor is someone who joins the project but is not the owner of the project.

AL jupyter extension:

1. panels: 
    - Header panel - same as coordinator
    - Labeling panel - same as coordinator
    - Project configuration panel - same as coordinator
    - Model updates panel - say that: model updates are only available to coordinator, will be visible after the project ends and the final results are published and will appear in storage
    - User dashboard panel - same as coordinator
    - Voting history - same as coordinator
    - Publish final results - only available to coordinator, either make it say ‘only coordinator can publish’ or remove the panel for the contributor completely
2. Project Flow:
    1. Coordinator waits for coordinator to start next iteration
    2. When coordinator starts next iteration, project smart contract communicates that to contributor’s dal jupyter extension
    3. Dal jupyter extension displays voting
    4. Dal jupyter extension contributor submits their votes
    5. Dal jupyter extension communicates the contributor’s votes to project smart contraact
    6. Repeat from step 1

- The functionalities are already implemented for the coordinator. We probably just need a condition checking the role of the contributor/coordinator (fetched from smart contract) and modify it for the contributor. We probably do not even need new files.