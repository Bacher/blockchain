const fs = require('fs-extra');
const BlockMiner = require('./BlockMiner');

class Blocks {
    async load() {
        const json = await fs.readFile('./data/blocks.json');

        const blocks = JSON.parse(json);

        for (let block of blocks) {
            block.rawData = block.data;
            block.data = JSON.parse(block.rawData);
        }

        this._blocks = blocks;

        this.nextBlockMinersOrder = BlockMiner.getNextBlockMinersOrder(this.getLast());

        console.log('Blocks loaded, length', this._blocks.length);
    }

    resetChain(blocks) {
        for (let block of blocks) {
            block.rawData = block.data;
            block.data = JSON.parse(block.rawData);
        }

        const blockNum = blocks[0].data.blockNum;

        this._blocks = this._blocks.slice(0, blockNum).concat(blocks);

        console.log('Blockchain was reset to', this.getLast().hash);
    }

    get(index) {
        return this._blocks[index];
    }

    getLast() {
        return this._blocks[this._blocks.length - 1];
    }

    add(block) {
        block.rawData = block.data;
        block.data = JSON.parse(block.rawData);

        const lastBlock = this.getLast();

        console.log(
            'NEW BLOCK',
            block.data.blockNum,
            block.data.nodePort,
            'tx:',
            block.data.transactions.length,
            block.stamp,
            new Date(block.data.stamp) - new Date(lastBlock.data.stamp),
            block.hash
        );

        this._blocks.push(block);
        this.nextBlockMinersOrder = BlockMiner.getNextBlockMinersOrder(block);
        console.log('miners order:', this.nextBlockMinersOrder);
    }
}

module.exports = Blocks;
