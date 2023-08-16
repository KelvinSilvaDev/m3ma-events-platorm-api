// src/middlewares/verifyJWT.ts

import fastify from "fastify";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../utils/jwtUtils";

export const verifyJWT = async (request: any, reply: any, next: any) => {
  // ... Your verifyJWT middleware logic
};
