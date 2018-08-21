const crypto = require('crypto');
const config = require('./config');

const secret = '0';

class BlockMiner {
    static getNextBlockMinersOrder(block) {
        const order = [];

        for (let node of config.nodes) {
            const key = block.hash + node.publicKey;

            const hash = crypto
                .createHmac('sha256', secret)
                .update(key)
                .digest('hex');

            const value = parseInt(hash.substr(0, 8), 16);

            order.push({
                port: node.port,
                value,
            });
        }

        order.sort((a, b) => a.value - b.value);

        return order.map(a => a.port);
    }
}

module.exports = BlockMiner;
