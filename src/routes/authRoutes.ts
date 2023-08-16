// src/routes/authRoutes.ts

import { FastifyInstance } from "fastify";
import { registerUser, loginUser } from "../controllers/authController";

export function authRoutes(app: FastifyInstance) {
  app.post("/register", registerUser);
  app.post("/login", loginUser);
}
