[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![Build Status](https://travis-ci.org/deepforge-dev/deepforge-keras.svg?branch=master)](https://travis-ci.org/deepforge-dev/deepforge-keras)

# deepforge-keras
`deepforge-keras` is an extension for [deepforge](https://deepforge.org) providing keras support.

## Installation
`deepforge-keras` can be added to any deepforge deployment with:
```
deepforge extensions add deepforge-dev/deepforge-keras
```

This requires that some additional python dependencies are available on the worker machines (including tensorflow). Before starting the worker, be sure to install the conda environment and activate it:
```
conda env create --file environment.worker.yml
conda activate deepforge-keras
```

Similarly, be sure to install the server dependencies and activate the respective conda environment:
```
conda env create --file environment.server.yml
conda activate deepforge-keras-server
```

```bash
```
## Development and Debugging Setup
deepforge-keras is set up and developed just like a standalone webgme app. First, install the deepforge-keras following:
- [NodeJS](https://nodejs.org/en/) (LTS recommended)
- [MongoDB](https://www.mongodb.com/)

Second, start mongodb locally by running the `mongod` executable in your mongodb installation (you may need to create a `data` directory or set `--dbpath`).

Then, run the following from the project root:

```
npm install
npm start
```

Finally, navigate to `http://localhost:8888` to check out deepforge-keras!

### Automated Testing
Tests are stored in `test/` and are run using `npm test`. It is highly recommended to include tests when submitting new features or fixing bugs.

