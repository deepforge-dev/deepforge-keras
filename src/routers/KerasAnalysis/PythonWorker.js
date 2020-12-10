const zmq = require('zeromq');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

class PythonWorker {
    constructor(logger, workdir=os.tmpdir()) {
        this.logger = logger.fork('PythonWorker');
        const socket = new zmq.Request();
        const address = `ipc://${path.join(workdir, 'ipc-socket')}`;
        socket.connect(address);
        this.socket = new MsgQueue(socket);
        this._startWorker(address, workdir);
    }

    async analyze(pythonFile) {
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
        job.on('close', code => this.logger.warn(`Python worker exited with code: ${code}`));
    }
}

class MsgQueue {
    constructor(socket) {
        this.socket = socket;
        this.sendOp = Promise.resolve();
    }

    send(data) {
        return this.sendOp = this.sendOp.then(() => this.socket.send(data));
    }

    receive() {
        return this.socket.receive();
    }
}

module.exports = PythonWorker;
