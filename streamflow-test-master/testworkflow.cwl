cwlVersion: v1.2
class: Workflow

inputs:
  hash: string      # The hash of the IPFS object to fetch
outputs:
  out:
    type: File
    outputSource: query/fileContent

steps:
  setup:            # Start up the IPFS node
    run:
      class: CommandLineTool
      requirements:
        NetworkAccess:
          networkAccess: true
      baseCommand: ["docker"]
      arguments:
        - valueFrom: "run"
        - valueFrom: "-d"
        - valueFrom: "--name"
        - valueFrom: "ipfs_node_cwl"
        - valueFrom: "-p"
        - valueFrom: "127.0.0.1:5001:5001" # 127.0.0.1: only to expose to localhost, not the internet
        - valueFrom: "-v"
        - valueFrom: "$(runtime.outdir)/ipfs_data:/data/ipfs"
        - valueFrom: "ipfs/kubo:master-latest"
        - valueFrom: "daemon"
      stdout: log.txt
      inputs: []
      outputs:
        containerId:
          type: string
          outputBinding:
            glob: log.txt
            loadContents: true
            outputEval: $(self[0].contents)
    in: {}
    out: [containerId]

  query:        # Query the IPFS node for the file content
    run:
      class: CommandLineTool
      baseCommand: ["docker"]
      requirements:
        NetworkAccess:
          networkAccess: true
      arguments:
        - valueFrom: "exec"
        - valueFrom: "ipfs_node_cwl"
        - valueFrom: "ipfs"
        - valueFrom: "--api"
        - valueFrom: "/ip4/127.0.0.1/tcp/5001"
        - valueFrom: "cat"
        - valueFrom: "$(inputs.hash)"
      stdout: output.txt
      inputs:
        containerId:
          type: string
        hash:
          type: string
      outputs:
        fileContent:
          type: File
          outputBinding:
            glob: output.txt
        containerId:
          type: string
          outputBinding:
            glob: "$(inputs.containerId)"
    in:
      hash: hash
      containerId: setup/containerId
    out: [fileContent, containerId]
  kill:        # Stop the IPFS node
    run:
      class: CommandLineTool
      baseCommand: ["docker", "stop"]
      arguments:
        - valueFrom: "$(inputs.containerId)"
      inputs:
        containerId:
          type: string
      outputs:
        containerId:
          type: string
          outputBinding:
            glob: "$(inputs.containerId)"
    in:
      containerId: query/containerId
    out: [containerId]
  cleanup:  # Remove the IPFS node container
    run:
      class: CommandLineTool
      baseCommand: ["docker", "container", "rm"]
      arguments:
        - valueFrom: "$(inputs.containerId)"
      inputs:
        containerId:
          type: string
      outputs: []
    in:
      containerId: kill/containerId
    out: []
