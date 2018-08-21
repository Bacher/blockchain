const { Server } = require('rpc-easy');

class BlockchainServer {
    constructor(connections) {
        this._connections = connections;

        const server = new Server({
            redirectErrors: true,
        });

        server.on('connection', connection => {
            this._connections.addClient(connection);
        });

        server.on('error', err => {
            console.log('server error:', err);
        });

        this._server = server;
    }

    listen(options) {
        return new Promise((resolve, reject) => {
            this._server.listen(options, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        })
    }
}

module.exports = BlockchainServer;
