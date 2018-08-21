const { EventEmitter } = require('events');

class Connections extends EventEmitter {
    constructor(port) {
        super();

        this._port = port;
        this._connections = new Set();
        this._nodes = new Map();
    }

    addClient(connection) {
        this.add(connection);

        connection
            .request('registration', {
                nodePort: this._port,
            })
            .catch(noop);
    }

    add(connection) {
        this._connections.add(connection);

        connection.on('message', data => {
            console.log('new message:', data);
        });

        connection.on('close', () => {
            console.log('socket close');
            this._connections.delete(connection);
            this._nodes.delete(connection.nodePort);
        });

        connection.setRequestHandler((apiName, data) =>
            this._onApiCallSafe(connection, apiName, data)
        );
    }

    has(port) {
        return this._connections.has(port);
    }

    async broadcastRequest(apiName, data) {
        const waits = [];

        for (let [, node] of this._nodes) {
            waits.push(node.request(apiName, data));
        }

        await Promise.all(waits);
    }

    safeBroadcastRequest(apiName, data) {
        this.broadcastRequest(apiName, data).catch(err => {
            console.error(err);
        });
    }

    close(port) {
        const connection = this._nodes.get(port);

        if (connection) {
            this._connections.delete(connection);
            this._nodes.delete(port);
            connection.close();
        }
    }

    async _onApiCallSafe(...args) {
        try {
            await this._onApiCall(...args);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async _onApiCall(connection, apiName, data) {
        switch (apiName) {
            case 'registration': {
                const nodePort = data.nodePort;

                if (this._nodes.has(nodePort)) {
                    connection.request('duplicate').catch(noop);
                } else {
                    connection
                        .request('registrationAck', {
                            nodePort: this._port,
                        })
                        .catch(noop);

                    connection.nodePort = nodePort;
                    this._nodes.set(nodePort, connection);
                }
                return;
            }
            case 'duplicate':
                console.log('duplication, closing connection');
                connection.close();
                return;
            case 'registrationAck': {
                const nodePort = data.nodePort;

                if (this._nodes.has(nodePort)) {
                    this._nodes
                        .get(nodePort)
                        .request('duplicate')
                        .catch(noop);
                }

                connection.nodePort = nodePort;
                this._nodes.set(nodePort, connection);
                return;
            }
            case 'addTransaction': {
                this.emit('newtransaction', data);
                return;
            }
            case 'newBlock': {
                this.emit('newblock', data);
                return;
            }
        }

        console.error('UNKNOWN API', apiName);
        throw new Error('INVALID_API_NAME');
    }
}

function noop() {}

module.exports = Connections;
