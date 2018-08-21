const { Connection } = require('rpc-easy');

class Connector {
    constructor(connections, ports) {
        this._connections = connections;
        this._ports = ports;
    }

    connect() {
        for (let port of this._ports) {
            if (!this._connections.has(port)) {
                Connection.connect({
                    host: 'localhost',
                    port,
                }).then(connection => {
                    this._connections.add(connection);
                }, err => {
                    // Do nothing
                });
            }
        }
    }
}

module.exports = Connector;
