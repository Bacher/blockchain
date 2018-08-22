const crypto = require('asymmetric-crypto');
const config = require('./config');

class Block {
    static signBlock(data) {
        return crypto.sign(data, config.keys.secretKey);
    }

    static verifyBlock(block) {
        return crypto.verify(block.data, block.hash, block.publicKey);
    }

    constructor(prevBlock) {
        this._prevBlock = prevBlock;
        this._transactions = [];
    }

    addTransaction(data) {
        const json = JSON.stringify(data);
        this._transactions.push(json);
    }

    seal() {
        const prev = this._prevBlock;
        this._sealStamp = new Date();

        const data = JSON.stringify({
            prevHash: prev.hash,
            blockNum: prev.data.blockNum + 1,
            nodePort: config.port,
            transactions: this._transactions,
            stamp: this._sealStamp,
        });

        return {
            data,
            hash: Block.signBlock(data),
            publicKey: config.keys.publicKey,
        };
    }
}

module.exports = Block;
