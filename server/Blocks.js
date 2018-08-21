const fs = require('fs-extra');
const BlockMiner = require('./BlockMiner');

class Blocks {
    async load() {
        const json = await fs.readFile('./data/blocks.json');

        const blocks = JSON.parse(json);

        for (let block of blocks) {
            block.data = JSON.parse(block.data);
        }

        this._blocks = blocks;

        this.nextBlockMinersOrder = BlockMiner.getNextBlockMinersOrder(this.getLast());

        console.log('Blocks loaded, length', this._blocks.length);
    }

    getLast() {
        return this._blocks[this._blocks.length - 1];
    }

    add(block) {
        block.data = JSON.parse(block.data);

        const lastBlock = this.getLast();

        console.log(
            'NEW BLOCK',
            block.data[0],
            block.data[1],
            block.data[2],
            'tx:',
            block.data[3].length,
            block.data[4],
            new Date(block.data[4]) - new Date(lastBlock.data[4])
        );

        this._blocks.push(block);
        this.nextBlockMinersOrder = BlockMiner.getNextBlockMinersOrder(block);
        console.log('miners order:', this.nextBlockMinersOrder);
    }
}

module.exports = Blocks;
