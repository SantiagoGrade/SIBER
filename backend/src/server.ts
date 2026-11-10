import { crearApp } from "./app";
import { env } from "./config/env";
import { iniciarJobs, detenerJobs } from "./jobs";
import { prisma } from "./repositories/prisma";

const app = crearApp();
const server = app.listen(env.port, () => {
  console.log(`SIBER backend escuchando en http://localhost:${env.port}`);
  iniciarJobs();
});

async function apagar() {
  detenerJobs();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", apagar);
process.on("SIGTERM", apagar);
