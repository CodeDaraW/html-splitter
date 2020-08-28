import { FifoCache } from '../src';

const cache = new FifoCache(3);

describe('cache', () => {
    test('basic usage', () => {
        cache.set('0', '0');
        expect(cache.get('0')).toBe('0');
    });

    test('over limit', () => {
        Array(5).fill(0).forEach((_, index) => {
            cache.set(`${index}`, `${index}`);
        });
        expect(cache.get('0')).toBeUndefined();
    });
});
