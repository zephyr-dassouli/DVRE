cwlVersion: v1.2
class: Workflow
inputs:
  tarball: File
  name_of_file_to_extract: string

outputs:
  compiled_class:
    type: File
    outputSource: compile/classfile

steps:
  untar:
    run:
      class: CommandLineTool
      baseCommand: [tar, --extract]
      inputs:
        tarfile:
          type: File
          inputBinding:
            prefix: --file
        extractfile: string
      outputs:
        extracted_file:
          type: File
          outputBinding:
            glob: $(inputs.extractfile)
    in:
      tarfile: tarball
      extractfile: name_of_file_to_extract
    out: [extracted_file]

  compile:
    run:
      class: CommandLineTool
      baseCommand: javac
      arguments: ["-d", $(runtime.outdir)]
      inputs:
        src:
          type: File
          inputBinding:
            position: 1
      outputs:
        classfile:
          type: File
          outputBinding:
            glob: "*.class"
    in:
      src: untar/extracted_file
    out: [classfile]