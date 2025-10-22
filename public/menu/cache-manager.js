/**
 * Cache Manager - Sistema de caché centralizado usando sessionStorage
 * Estrategia: stale-while-revalidate (mostrar caché → revalidar en background)
 */

const CacheManager = (() => {
    // TTL por defecto: 5 minutos
    const DEFAULT_TTL = 5 * 60 * 1000;

    /**
     * Generar clave de caché única basada en token y tipo
     */
    function getCacheKey(token, type) {
        return `payme_cache_${token}_${type}`;
    }

    /**
     * Obtener datos del caché
     * @param {string} token - Token de sesión
     * @param {string} type - Tipo de datos (user, profile, bank, loans)
     * @returns {object|null} Datos cacheados o null si no existe/expiró
     */
    function get(token, type) {
        try {
            const key = getCacheKey(token, type);
            const cached = sessionStorage.getItem(key);

            if (!cached) {
                return null;
            }

            const { data, timestamp, ttl } = JSON.parse(cached);
            const now = Date.now();
            const age = now - timestamp;

            // Verificar si expiró
            if (age > ttl) {
                console.log('[Cache] Expired:', { key, age, ttl });
                sessionStorage.removeItem(key);
                return null;
            }

            console.log('[Cache] Hit:', { key, age, ttl });
            return data;
        } catch (error) {
            console.error('[Cache] Error getting cache:', error);
            return null;
        }
    }

    /**
     * Guardar datos en el caché
     * @param {string} token - Token de sesión
     * @param {string} type - Tipo de datos
     * @param {object} data - Datos a cachear
     * @param {number} ttl - Time to live en milisegundos (opcional)
     */
    function set(token, type, data, ttl = DEFAULT_TTL) {
        try {
            const key = getCacheKey(token, type);
            const cacheEntry = {
                data,
                timestamp: Date.now(),
                ttl
            };

            sessionStorage.setItem(key, JSON.stringify(cacheEntry));
            console.log('[Cache] Set:', { key, ttl });
        } catch (error) {
            console.error('[Cache] Error setting cache:', error);
            // Si falla (ej: cuota excedida), limpiar caché antiguo
            if (error.name === 'QuotaExceededError') {
                clear();
                // Reintentar
                try {
                    sessionStorage.setItem(key, JSON.stringify(cacheEntry));
                } catch (retryError) {
                    console.error('[Cache] Retry failed:', retryError);
                }
            }
        }
    }

    /**
     * Invalidar/eliminar entrada de caché
     * @param {string} token - Token de sesión
     * @param {string} type - Tipo de datos
     */
    function invalidate(token, type) {
        try {
            const key = getCacheKey(token, type);
            sessionStorage.removeItem(key);
            console.log('[Cache] Invalidated:', { key });
        } catch (error) {
            console.error('[Cache] Error invalidating cache:', error);
        }
    }

    /**
     * Verificar si un caché está stale (próximo a expirar)
     * @param {string} token - Token de sesión
     * @param {string} type - Tipo de datos
     * @param {number} threshold - Umbral en milisegundos (default: 1 minuto)
     * @returns {boolean}
     */
    function isStale(token, type, threshold = 60 * 1000) {
        try {
            const key = getCacheKey(token, type);
            const cached = sessionStorage.getItem(key);

            if (!cached) {
                return true;
            }

            const { timestamp, ttl } = JSON.parse(cached);
            const now = Date.now();
            const age = now - timestamp;
            const remaining = ttl - age;

            return remaining < threshold;
        } catch (error) {
            console.error('[Cache] Error checking staleness:', error);
            return true;
        }
    }

    /**
     * Limpiar todo el caché de PayME
     */
    function clear() {
        try {
            const keys = Object.keys(sessionStorage);
            const paymeKeys = keys.filter(key => key.startsWith('payme_cache_'));

            paymeKeys.forEach(key => {
                sessionStorage.removeItem(key);
            });

            console.log('[Cache] Cleared:', { count: paymeKeys.length });
        } catch (error) {
            console.error('[Cache] Error clearing cache:', error);
        }
    }

    /**
     * Obtener estadísticas del caché
     * @returns {object}
     */
    function getStats() {
        try {
            const keys = Object.keys(sessionStorage);
            const paymeKeys = keys.filter(key => key.startsWith('payme_cache_'));
            const now = Date.now();

            const stats = {
                total: paymeKeys.length,
                valid: 0,
                expired: 0,
                totalSize: 0
            };

            paymeKeys.forEach(key => {
                const value = sessionStorage.getItem(key);
                stats.totalSize += value.length;

                try {
                    const { timestamp, ttl } = JSON.parse(value);
                    const age = now - timestamp;

                    if (age > ttl) {
                        stats.expired++;
                    } else {
                        stats.valid++;
                    }
                } catch (e) {
                    stats.expired++;
                }
            });

            // Convertir size a KB
            stats.totalSizeKB = (stats.totalSize / 1024).toFixed(2);

            return stats;
        } catch (error) {
            console.error('[Cache] Error getting stats:', error);
            return { total: 0, valid: 0, expired: 0, totalSize: 0 };
        }
    }

    // API pública
    return {
        get,
        set,
        invalidate,
        isStale,
        clear,
        getStats
    };
})();

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.CacheManager = CacheManager;
}
