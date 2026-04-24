const buckets = new Map();

function takeRateLimitToken(key, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count <= limit;
}

module.exports = { takeRateLimitToken };
