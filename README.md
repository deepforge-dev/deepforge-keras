[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![Build Status](https://travis-ci.org/deepforge-dev/deepforge.svg?branch=master)](https://travis-ci.org/deepforge-dev/deepforge)

**Notice**: This extension is still very much under development in preparation for the deepforge v2 release and is not ready for non-development use just yet!

# deepforge-keras
`deepforge-keras` is an extension for [deepforge](https://deepforge.org) providing keras support.

## Installation

## Development and Debugging Setup
deepforge-keras is set up and developed just like a standalone webgme app. First, install the deepforge-keras following:
- [NodeJS](https://nodejs.org/en/) (v6 recommended)
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
