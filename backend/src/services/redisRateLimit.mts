import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';

async function createRedisRateLimit(url: string) {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: retries => retries < 3 ? 250 * (retries + 1) : false,
    },
  });
  client.on('error', (error: Error) => console.error('[Redis]', error.name));

  await client.connect();
  const store = new RedisStore({
    prefix: 'caresync:api:rate-limit:',
    sendCommand: (...args: string[]) => client.sendCommand(args),
  });

  return {
    store,
    disconnect: () => { if (client.isOpen) client.destroy(); },
  };
}

export { createRedisRateLimit };
