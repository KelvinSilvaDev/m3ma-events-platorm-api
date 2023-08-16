import { FastifyInstance } from "fastify";
import { getUsers } from "../controllers/userController";

export function userRoutes(app: FastifyInstance) {
  app.get("/users", getUsers);
}
