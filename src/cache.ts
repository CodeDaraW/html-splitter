export class FifoCache<K extends string, V> {
    private limit: number;

    private map: Record<K, V>;

    private keys: K[];

    constructor(limit: number = 10) {
        this.limit = limit;
        this.map = {} as Record<K, V>;
        this.keys = [];
    }

    set(key: K, value: V) {
        const { map, keys } = this;
        if (!Object.prototype.hasOwnProperty.call(map, key)) {
            if (keys.length === this.limit) {
                const firstKey = keys.shift();
                if (firstKey) {
                    delete map[firstKey];
                }
            }
            keys.push(key);
        }
        map[key] = value;
    }

    get(key: K): V | undefined {
        return this.map[key];
    }
}
