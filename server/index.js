const BlockchainServer = require('./BlockchainServer');
const Connections = require('./Connections');
const Connector = require('./Connector');
const Block = require('./Block');
const Blocks = require('./Blocks');
const BlockMiner = require('./BlockMiner');
const TransactionQueue = require('./TransactionQueue');
const config = require('./config');

const AUTHORS = ['bacher', 'nikita', 'alex', 'john'];

const NODES_PORTS = config.nodes.map(node => node.port);

const port = config.port;

let timeoutId = null;

async function init() {
    const blocks = new Blocks();
    const tQueue = new TransactionQueue();

    await blocks.load();

    const connections = new Connections(port);
    const server = new BlockchainServer(connections);
    const connector = new Connector(
        connections,
        NODES_PORTS.filter(p => p !== port)
    );

    connections.on('newtransaction', data => {
        tQueue.add(data);
    });

    connections.on('newblock', block => {
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

        const lastBlock = blocks.getLast();

        const index = blocks.nextBlockMinersOrder.indexOf(nodePort);

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

        if (lastBlock.hash !== prevHash) {
            console.error('INVALID PREV HASH');
            return;
        }

        for (let tx of transactions) {
            tQueue.removeTransaction(tx);
        }

        addBlock(block);
    });

    function addBlock(block) {
        blocks.add(block);
        clearTimeout(timeoutId);
        checkNextBlockMiner();
    }

    function checkNextBlockMiner() {
        const index = blocks.nextBlockMinersOrder.indexOf(config.port);

        timeoutId = setTimeout(() => {
            const newBlock = new Block(blocks.getLast());

            for (let tx of tQueue.get()) {
                newBlock.addTransaction(tx);
            }

            tQueue.clear();

            const block = newBlock.seal();

            connections.safeBroadcastRequest('newBlock', block);

            addBlock(block);
        }, (30 + index * 10) * 1000);
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

    connector.connect();

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
            connections.safeBroadcastRequest('addTransaction', tx);
        }, Math.floor(Math.random() * 5000));
    }
}

init().catch(err => {
    console.error(err);
    process.exit(1);
});
