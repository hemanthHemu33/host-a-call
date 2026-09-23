import net from 'node:net';

const listenPort = Number.parseInt(
  process.env.METRO_IPV4_PROXY_PORT ?? '8082',
  10,
);
const targetPort = Number.parseInt(process.env.METRO_PORT ?? '8081', 10);
const targetHost = process.env.METRO_IPV4_PROXY_TARGET_HOST ?? '::1';

const server = net.createServer((client) => {
  const upstream = net.connect({ host: targetHost, port: targetPort });

  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());

  client.pipe(upstream);
  upstream.pipe(client);
});

server.on('error', (error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

server.listen(listenPort, '127.0.0.1', () => {
  console.log(
    `metro ipv4 proxy listening on 127.0.0.1:${listenPort} -> [${targetHost}]:${targetPort}`,
  );
});
