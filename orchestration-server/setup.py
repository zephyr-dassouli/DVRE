import setuptools

setuptools.setup(
    name="dvre-orchestration-server",
    version='0.1.0',
    packages=['dvre_orchestration_server'],
    package_dir={'dvre_orchestration_server': 'src'},
    install_requires=[
        'jupyter_server',
    ],
    package_data={
        '': ['*.json'],
    },
    data_files=[
        ("etc/jupyter/jupyter_server_config.d", [
            "src/jupyter_server_config.json"
        ]),
    ],
) 