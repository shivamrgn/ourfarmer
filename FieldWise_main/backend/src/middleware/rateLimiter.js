/**
 * FieldWise Release Hardening: Production-Safe Rate Limiter Middleware
 * ====================================================================
 * Protects authentication and prediction endpoints from automated brute-forcing
 * and denial-of-service without external runtime dependencies.
 *
 * Multi-Instance Deployment Note:
 *   The default store operates in-memory per Node.js process. When running multiple
 *   backend instances behind a load balancer (e.g. Kubernetes, AWS ECS, Render clusters),
 *   provide a shared store (such as Redis) via the `store` option.
 */

class InMemoryRateLimitStore {
    constructor(cleanupIntervalMs = 60000) {
        this.hits = new Map();
        // Periodic garbage collection of expired buckets to prevent memory leak
        this.timer = setInterval(() => this.cleanup(), cleanupIntervalMs);
        if (this.timer.unref) this.timer.unref();
    }

    cleanup() {
        const now = Date.now();
        for (const [key, record] of this.hits.entries()) {
            if (record.resetTime <= now) {
                this.hits.delete(key);
            }
        }
    }

    increment(key, windowMs) {
        const now = Date.now();
        let record = this.hits.get(key);

        if (!record || record.resetTime <= now) {
            record = {
                count: 1,
                resetTime: now + windowMs,
            };
            this.hits.set(key, record);
            return {
                current: 1,
                resetTime: record.resetTime,
            };
        }

        record.count += 1;
        return {
            current: record.count,
            resetTime: record.resetTime,
        };
    }

    reset() {
        this.hits.clear();
    }

    destroy() {
        if (this.timer) clearInterval(this.timer);
    }
}

const defaultGlobalStore = new InMemoryRateLimitStore();

function createRateLimiter(options = {}) {
    const windowMs = options.windowMs || 60 * 1000; // Default: 1 minute
    const maxRequests = options.maxRequests || 60;   // Default: 60 requests per window
    const message = options.message || 'Too many requests from this client. Please slow down and try again later.';
    const keyPrefix = options.keyPrefix || 'rl';
    const store = options.store || defaultGlobalStore;
    const keyGenerator = options.keyGenerator || ((req) => {
        let ip = 'unknown';
        try {
            const forwarded = req.headers ? req.headers['x-forwarded-for'] : null;
            if (forwarded) {
                ip = String(forwarded).split(',')[0].trim();
            } else if (req.socket && req.socket.remoteAddress) {
                ip = req.socket.remoteAddress;
            } else if (req.ip) {
                ip = req.ip;
            }
        } catch {
            ip = 'unknown';
        }
        return `${keyPrefix}:${ip || 'unknown'}`;
    });

    const middleware = (req, res, next) => {
        const key = keyGenerator(req);
        const { current, resetTime } = store.increment(key, windowMs);
        const now = Date.now();
        const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));
        const remaining = Math.max(0, maxRequests - current);

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

        if (current > maxRequests) {
            res.setHeader('Retry-After', retryAfterSeconds);
            return res.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message,
                    retryAfterSeconds,
                },
            });
        }

        next();
    };

    middleware.reset = () => store.reset();
    middleware.store = store;

    return middleware;
}

module.exports = {
    createRateLimiter,
    InMemoryRateLimitStore,
};
