const zmq = require('zeromq');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

class PythonWorker {
    constructor(logger, workdir=os.tmpdir()) {
        this.logger = logger.fork('PythonWorker');
        this.socket = new zmq.Request();
        const address = `ipc://${path.join(workdir, 'ipc-socket')}`;
        this.socket.connect(address);
        this._startWorker(address, workdir);
    }

    async analyze(pythonFile) {
        // TODO: this needs to be queued!
        await this.socket.send(pythonFile);
        const [resultData] = await this.socket.receive();
        const result = JSON.parse(resultData.toString());
        if (result.success) {
            return result.data;
        } else {
            throw new Error(result.data);
        }
    }

    _startWorker(ipcSocket, workdir) {
        const pythonPath = path.join(__dirname, 'PythonWorker.py');
        const job = childProcess.spawn('python', [pythonPath, ipcSocket], {cwd: workdir});
        job.stdout.on('data', data => console.log('+', data.toString()));
        job.stderr.on('data', data => console.log('-', data.toString()));
        job.on('close', code => this.logger.warn(`Python worker exited with code: ${code}`));
    }
}

module.exports = PythonWorker;
