class TransactionQueue {
    constructor() {
        this._queue = [];
    }

    get() {
        return this._queue;
    }

    clear() {
        this._queue = [];
    }

    add(data) {
        this._queue.push(data);
    }

    removeTransaction(tx) {
        this._queue = this._queue.filter(_tx => _tx !== tx);
    }
}

module.exports = TransactionQueue;
