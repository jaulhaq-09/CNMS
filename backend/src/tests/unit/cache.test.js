describe('cache utils', () => {
  let mockRedisInstance;
  let getCached, setCached, invalidatePattern, DEFAULT_TTL_SECONDS;

  function triggerReady() {
    const handler = mockRedisInstance.on.mock.calls.find(([event]) => event === 'ready')?.[1];
    if (handler) handler();
  }

  beforeEach(() => {
    jest.resetModules();

    mockRedisInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      set: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
      on: jest.fn(),
    };

    jest.doMock('ioredis', () => jest.fn().mockImplementation(() => mockRedisInstance));
    jest.doMock('../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    ({ getCached, setCached, invalidatePattern, DEFAULT_TTL_SECONDS } = require('../../utils/cache'));
  });

  afterEach(() => {
    jest.dontMock('ioredis');
    jest.dontMock('../../utils/logger');
  });

  describe('when Redis is unavailable', () => {
    it('getCached returns null without throwing', async () => {
      const result = await getCached('some:key');
      expect(result).toBeNull();
      expect(mockRedisInstance.get).not.toHaveBeenCalled();
    });

    it('setCached does nothing without throwing', async () => {
      await setCached('some:key', { a: 1 });
      expect(mockRedisInstance.set).not.toHaveBeenCalled();
    });

    it('invalidatePattern does nothing without throwing', async () => {
      await invalidatePattern('search:*');
      expect(mockRedisInstance.keys).not.toHaveBeenCalled();
    });

    it('handles connect() rejecting (Redis genuinely unreachable) gracefully', async () => {
      mockRedisInstance.connect.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await getCached('some:key');
      expect(result).toBeNull();
    });

    it('only attempts to connect once across multiple calls', async () => {
      await getCached('key1');
      await getCached('key2');
      await setCached('key3', {});
      expect(mockRedisInstance.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('when Redis is available (ready event fired)', () => {
    beforeEach(() => {
      triggerReady();
    });

    it('getCached returns the parsed value on a hit', async () => {
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ foo: 'bar' }));

      const result = await getCached('analytics:dashboard:30');

      expect(result).toEqual({ foo: 'bar' });
      expect(mockRedisInstance.get).toHaveBeenCalledWith('analytics:dashboard:30');
    });

    it('getCached returns null on a miss (key does not exist)', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await getCached('nonexistent:key');

      expect(result).toBeNull();
    });

    it('getCached returns null and logs a warning if get() throws', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Connection reset'));

      const result = await getCached('some:key');

      expect(result).toBeNull();
    });

    it('setCached stores the value JSON-stringified with the given TTL', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');

      await setCached('search:global:test', { hits: 5 }, 30);

      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        'search:global:test',
        JSON.stringify({ hits: 5 }),
        'EX',
        30
      );
    });

    it('setCached uses DEFAULT_TTL_SECONDS when no TTL is given', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');

      await setCached('some:key', { x: 1 });

      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        'some:key',
        JSON.stringify({ x: 1 }),
        'EX',
        DEFAULT_TTL_SECONDS
      );
    });

    it('setCached does not throw if set() fails', async () => {
      mockRedisInstance.set.mockRejectedValue(new Error('Write failed'));
      await expect(setCached('some:key', {})).resolves.toBeUndefined();
    });

    it('invalidatePattern deletes every key matching the pattern', async () => {
      mockRedisInstance.keys.mockResolvedValue(['search:global:a', 'search:global:b']);
      mockRedisInstance.del.mockResolvedValue(2);

      await invalidatePattern('search:global:*');

      expect(mockRedisInstance.keys).toHaveBeenCalledWith('search:global:*');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('search:global:a', 'search:global:b');
    });

    it('invalidatePattern does not call del when no keys match', async () => {
      mockRedisInstance.keys.mockResolvedValue([]);

      await invalidatePattern('nomatch:*');

      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });

    it('invalidatePattern does not throw if keys() fails', async () => {
      mockRedisInstance.keys.mockRejectedValue(new Error('Redis error'));
      await expect(invalidatePattern('x:*')).resolves.toBeUndefined();
    });
  });

  describe('DEFAULT_TTL_SECONDS', () => {
    it('is exported and set to 60', () => {
      expect(DEFAULT_TTL_SECONDS).toBe(60);
    });
  });
});