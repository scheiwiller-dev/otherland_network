import { describe, expect, it } from 'vitest';
import { CARDINAL_OFFLINE_STATUS, clearNetworkStatus, reportCardinalUnavailable, setNetworkStatus } from './networkStatus.js';
import { CARDINAL_UNREACHABLE, withTimeout } from './network.js';

describe('Cardinal offline status', () => {
    it('writes a calm network status and can clear it', () => {
        const el = { textContent: 'stale' };
        globalThis.document = { getElementById: (id) => (id === 'network-status' ? el : null) };

        reportCardinalUnavailable(new Error('down'));
        expect(el.textContent).toBe(CARDINAL_OFFLINE_STATUS);
        expect(CARDINAL_OFFLINE_STATUS).toMatch(/TreeHouse/);
        expect(CARDINAL_OFFLINE_STATUS).not.toMatch(/error/i);

        clearNetworkStatus();
        expect(el.textContent).toBe('');

        setNetworkStatus('Node list ready');
        expect(el.textContent).toBe('Node list ready');
    });
});

describe('withTimeout', () => {
    it('rejects a call that does not finish', async () => {
        await expect(withTimeout(new Promise(() => {}), 20, CARDINAL_UNREACHABLE))
            .rejects.toThrow(CARDINAL_UNREACHABLE);
    });

    it('returns the value when the call finishes', async () => {
        await expect(withTimeout(Promise.resolve('ok'), 50, CARDINAL_UNREACHABLE)).resolves.toBe('ok');
    });
});
