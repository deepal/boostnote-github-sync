module.exports = class Lock {
    constructor() {
        this.lock = false;
    }

    /**
     * Aquire lock
     * @returns {boolean}
     */
    aquire() {
        if (!this.lock) {
            this.lock = true;
            return true;
        }
        return false;
    }

    /**
     * Release lock
     * @returns {void}
     */
    release() {
        this.lock = false;
    }
}
