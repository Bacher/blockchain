const { Connection } = require('rpc-easy');

class Connector {
    constructor(connections, ports) {
        this._connections = connections;
        this._ports = ports;
    }

    async connect() {
        const wait = [];

        for (let port of this._ports) {
            if (!this._connections.has(port)) {
                const promise = Connection.connect({
                    host: 'localhost',
                    port,
                }).then(connection => {
                    this._connections.add(connection);
                }, noop);

                wait.push(promise);
            }
        }

        await Promise.all(wait);
    }
}

function noop() {}

module.exports = Connector;
