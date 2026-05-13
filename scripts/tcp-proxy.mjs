import net from "net";

const FROM_PORT = Number(process.env.PROXY_FROM ?? 5000);
const TO_PORT = Number(process.env.PROXY_TO ?? 19224);

const server = net.createServer((client) => {
  const target = net.createConnection(TO_PORT, "localhost");
  client.pipe(target);
  target.pipe(client);
  client.on("error", () => target.destroy());
  target.on("error", () => client.destroy());
  target.on("close", () => client.destroy());
  client.on("close", () => target.destroy());
});

server.listen(FROM_PORT, () => {
  console.log(`TCP proxy: ${FROM_PORT} → ${TO_PORT}`);
});
