/**
 * Test app factory — creates a fully configured Express app for integration tests.
 * Matches the middleware stack in server.ts.
 */
import express from "express";
import cors from "cors";
import { apiRouter } from "@/api/index";

export function createTestApp() {
  const app = express();
  app.use(cors({ origin: "*" }));
  app.use(express.json());
  app.use("/api", apiRouter);
  return app;
}