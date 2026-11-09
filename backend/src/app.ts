import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { router } from "./routes";
import { manejadorErrores, noEncontrado } from "./middleware/errors";

export function crearApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({
    contentSecurityPolicy: false, // el frontend se sirve por separado
  }));
  app.use(cors({
    origin: env.corsOrigins,
    credentials: true,
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/v1", router);
  app.use(noEncontrado);
  app.use(manejadorErrores);
  return app;
}
