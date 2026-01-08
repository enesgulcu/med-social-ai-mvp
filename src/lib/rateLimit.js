// Türkçe yorum: Basit rate limit; in-memory (dev için). Prod için DB tabanlı olabilir.

// Türkçe yorum: Kullanıcı başına dakikada istek sayısı takibi.
const userRequests = new Map();

// Türkçe yorum: Temizlik; 1 dakika öncesindeki kayıtlar silinir.
setInterval(() => {
  const now = Date.now();
  for (const [userId, requests] of userRequests.entries()) {
    const filtered = requests.filter((timestamp) => now - timestamp < 60000);
    if (filtered.length === 0) {
      userRequests.delete(userId);
    } else {
      userRequests.set(userId, filtered);
    }
  }
}, 60000);

/**
 * Rate limit kontrolü yapar.
 * @param {string} userId - Kullanıcı ID
 * @param {number} maxRequests - Dakikada maksimum istek sayısı (default: 10)
 * @returns {Object} { allowed: boolean, remaining?: number, resetAt?: number }
 */
export function checkRateLimit(userId, maxRequests = 10) {
  if (!userId) {
    return { allowed: true };
  }

  const now = Date.now();
  const requests = userRequests.get(userId) || [];

  // Türkçe yorum: Son 1 dakikadaki istekleri filtrele.
  const recentRequests = requests.filter((timestamp) => now - timestamp < 60000);

  if (recentRequests.length >= maxRequests) {
    // Türkçe yorum: En eski isteğin 1 dakika sonrası reset zamanı.
    const oldestRequest = Math.min(...recentRequests);
    const resetAt = oldestRequest + 60000;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Türkçe yorum: Yeni isteği kaydet.
  recentRequests.push(now);
  userRequests.set(userId, recentRequests);

  return {
    allowed: true,
    remaining: maxRequests - recentRequests.length,
    resetAt: now + 60000,
  };
}

