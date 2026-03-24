/**
 * Promise-based wrapper around react-native-zeroconf.
 *
 * react-native-zeroconf uses an event-emitter API where scan() is synchronous
 * and results arrive via 'resolved' events. This module wraps that pattern
 * in a Promise + timeout so callers can simply await the results.
 */
export const ZeroconfModule = {
    /**
     * Scans for mDNS/Bonjour services and returns discovered devices.
     *
     * @param type - Service type without leading underscore, e.g. 'googlecast', 'airplay'
     * @param protocol - TCP or UDP (most services use 'tcp')
     * @param timeoutMs - How long to scan before resolving (default 5000 ms)
     */
    async scan(type, protocol = 'tcp', timeoutMs = 5000) {
        return new Promise((resolve) => {
            const devices = [];
            const seen = new Set();
            let zc;
            let scanStarted = false;
            function done() {
                clearTimeout(timer);
                if (scanStarted) {
                    try {
                        zc?.stop();
                    }
                    catch { /* ignore native teardown errors */ }
                }
                setTimeout(() => {
                    try {
                        zc?.removeDeviceListeners();
                    }
                    catch { /* ignore */ }
                }, 50);
                resolve(devices);
            }
            let timer;
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const Zeroconf = require('react-native-zeroconf').default;
                zc = new Zeroconf();
                zc.on('resolved', (...args) => {
                    const service = args[0];
                    const ipv4 = service.addresses?.find(a => a.includes('.') && !a.includes(':'));
                    const address = ipv4 ?? service.addresses?.[0] ?? service.host ?? '';
                    const key = `${service.name}-${address}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        devices.push({
                            name: service.txt?.fn ?? service.fullName ?? service.name,
                            address,
                            port: service.port ?? 0,
                            serviceType: type,
                            txt: service.txt ?? {},
                        });
                    }
                });
                zc.on('start', () => { scanStarted = true; });
                zc.on('error', (...args) => {
                    const err = args[0];
                    const msg = err instanceof Error ? err.message : String(err);
                    // Suppress known non-fatal Android NsdManager errors
                    if (/listener not registered|failed with code: 0/i.test(msg))
                        return;
                    console.warn('[ZeroconfModule] scan error:', msg);
                });
                timer = setTimeout(done, timeoutMs);
                zc.scan(type, protocol, 'local');
            }
            catch {
                resolve(devices);
            }
        });
    },
};
//# sourceMappingURL=ZeroconfModule.js.map