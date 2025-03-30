/**
 * Rate Limiter Middleware
 * Implements rate limiting based on request IP and user ID
 */
import { RateLimiterMemory } from 'rate-limiter-flexible';
import logger from '../utils/logger.js';
import config from '../config/config.js';

// Default rate limit options (if not configured in config)
const defaultLimiterOptions = {
  points: 100,            // 100 requests
  duration: 60 * 60,      // per hour
  blockDuration: 60 * 15  // Block for 15 minutes
};

// Get rate limiter options from config or use defaults
const limiterOptions = config.rateLimiting?.options || defaultLimiterOptions;

// Create a rate limiter instance
const rateLimiter = new RateLimiterMemory(limiterOptions);

/**
 * Rate limiting middleware
 * Limits requests based on IP address and user ID (if available)
 */
export default function rateLimiterMiddleware(req, res, next) {
  // Skip rate limiting if disabled in config
  if (config.rateLimiting?.enabled === false) {
    return next();
  }

  // Get client identifier (prefer user ID if authenticated, fallback to IP)
  const userId = req.user?.id || '';
  const clientIp = req.ip || req.connection.remoteAddress || '';
  const key = userId || clientIp;

  // Skip if we couldn't determine a key
  if (!key) {
    logger.warn('Rate limiter: No client identifier found, skipping rate limit check');
    return next();
  }

  // Consume points
  rateLimiter.consume(key)
    .then(rateLimiterRes => {
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limiterOptions.points);
      res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
      
      next();
    })
    .catch(rateLimiterRes => {
      // Rate limit exceeded
      logger.warn(`Rate limit exceeded for ${key}`);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limiterOptions.points);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
      res.setHeader('Retry-After', Math.ceil(rateLimiterRes.msBeforeNext / 1000));
      
      // Send rate limit error
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded, please try again later',
        retryAfter: Math.ceil(rateLimiterRes.msBeforeNext / 1000)
      });
    });
} 