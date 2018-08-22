const BlockchainServer = require('./BlockchainServer');
const Connections = require('./Connections');
const Connector = require('./Connector');
const Block = require('./Block');
const Blocks = require('./Blocks');
const TransactionQueue = require('./TransactionQueue');
const config = require('./config');

const AUTHORS = ['bacher', 'nikita', 'alex', 'john'];

const NODES_PORTS = config.nodes.map(node => node.port);

const port = config.port;

let timeoutId = null;

let isSyncing = true;

async function init() {
    const blocks = new Blocks();
    const tQueue = new TransactionQueue();

    await blocks.load();

    const connections = new Connections(port, blocks);
    const server = new BlockchainServer(connections);
    const connector = new Connector(
        connections,
        NODES_PORTS.filter(p => p !== port)
    );

    connections.on('newtransaction', data => {
        tQueue.add(data);
    });

    function addBlock(block) {
        blocks.add(block);
        clearTimeout(timeoutId);
        checkNextBlockMiner();
    }

    function checkNextBlockMiner() {
        const index = blocks.nextBlockMinersOrder.indexOf(config.port);

        if (index === -1) {
            return;
        }

        const lastBlock = blocks.getLast();

        const lastBlockStamp = new Date(lastBlock.data[4]);

        const interval = Math.max(
            0,
            lastBlockStamp.getTime() + (30 + index * 10) * 1000 - Date.now()
        );

        timeoutId = setTimeout(() => {
            const newBlock = new Block(blocks.getLast());

            for (let tx of tQueue.get()) {
                newBlock.addTransaction(tx);
            }

            tQueue.clear();

            const block = newBlock.seal();

            connections.broadcastRequest('newBlock', block);

            addBlock(block);
        }, interval);
    }

    server
        .listen({
            host: 'localhost',
            port,
        })
        .then(
            () => {
                console.log(`Listen ${port}`);
            },
            err => {
                console.log('^^^', err);
                process.exit(1);
            }
        );

    await connector.connect();

    await wait(1000);

    await syncState();

    connections.on('newblock', block => {
        if (isSyncing) {
            return;
        }

        const lastBlock = blocks.getLast();

        if (lastBlock.hash === block.hash) {
            return;
        }

        const [prevHash, , nodePort, transactions, stamp] = JSON.parse(
            block.data
        );

        const ts = new Date(stamp);

        if (!Block.verifyBlock(block)) {
            console.error('INVALID BLOCK HASH');
            return;
        }

        if (ts > Date.now() + 5000) {
            console.error('INVALID TIMESTAMP', stamp);
            return;
        }

        if (lastBlock.hash !== prevHash) {
            console.error('INVALID PREV HASH, start sync');

            syncState().catch(err => {
                console.error(err);
            });
            return;
        }

        const index = blocks.nextBlockMinersOrder.indexOf(nodePort);

        if (index === -1) {
            console.error('INVALID MINER');
            return;
        }

        const delta = stamp - lastBlock.data[4];

        if (delta < 30 + index * 10000) {
            console.error(
                'INVALID TIME INTERVAL',
                'index:',
                index,
                'delta:',
                delta
            );
            return;
        }

        for (let tx of transactions) {
            tQueue.removeTransaction(tx);
        }

        addBlock(block);
    });

    checkNextBlockMiner();

    startRandomDataLoop();

    function startRandomDataLoop() {
        setTimeout(() => {
            startRandomDataLoop();

            const tx = JSON.stringify({
                author: AUTHORS[Math.floor(Math.random() * AUTHORS.length - 1)],
                data: {
                    lol: Math.random(),
                    kek: Math.random(),
                    iAmFromNode: config.port,
                },
            });

            tQueue.add(tx);
            connections.broadcastRequest('addTransaction', tx);
        }, Math.floor(Math.random() * 5000));
    }

    async function syncState() {
        isSyncing++;

        let results = [];

        while (results.length === 0) {
            results = await connections.broadcastRequest('getState');

            if (results.length === 0) {
                await wait(1000);
            }
        }

        const myLast = blocks.getLast();

        let mostRecent = null;

        for (let response of results) {
            if (
                !mostRecent ||
                mostRecent.result.lastBlock.blockNum <
                    response.result.lastBlock.blockNum
            ) {
                mostRecent = response;
            }
        }

        if (myLast.hash !== mostRecent.result.hash) {
            if (
                myLast.data[1] < mostRecent.result.lastBlock.blockNum ||
                (myLast.data[1] === mostRecent.result.lastBlock.blockNum &&
                    myLast.hash < mostRecent.result.lastBlock.hash)
            ) {
                await startSyncing(
                    mostRecent.port,
                    mostRecent.result.lastBlock.blockNum
                );
            } else {
                await connections.broadcastRequest('newBlock', {
                    hash: myLast.hash,
                    data: myLast.rawData,
                    publicKey: myLast.publicKey,
                });
            }
        }

        isSyncing--;
    }

    async function startSyncing(port, blockNum) {
        console.log('start syncing', port, blockNum);

        let start = blockNum;

        const newBlocks = [];

        const node = connections.get(port);

        while (true) {
            const blocksPart = await node.request('getBlocks', {
                start,
                count: 10,
            });

            newBlocks.push(...blocksPart);

            const block = blocksPart[blocksPart.length - 1];
            const ourBlock = blocks.get(JSON.parse(block.data)[1]);

            if (ourBlock && block.hash === ourBlock.hash) {
                break;
            }

            if (start < 10) {
                throw new Error('INVARIANT');
            }

            start = Math.max(0, start - 10);
        }

        newBlocks.reverse();

        blocks.resetChain(newBlocks);
        tQueue.clear();

        // second syncState for completing sync
        await syncState();
    }
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

init().catch(err => {
    console.error(err);
    process.exit(1);
});
