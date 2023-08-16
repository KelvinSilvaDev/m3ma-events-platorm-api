// src/controllers/userController.ts

import fastify, { FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ensureAdminOrManager } from "../middlewares/ensureAdminOrManager";
import { verifyJWT } from "../middlewares/verifyJWT";

const app = fastify();

const prisma = new PrismaClient();

export async function getUsers(request: FastifyRequest, reply: FastifyReply) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
    return { users };
  } catch (error) {
    console.log(error);
    reply.status(500).send({ error: "Internal Server Error" });
  }
}

export async function registerUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const createUserSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    password: z.string(),
  });

  try {
    const { name, email, password } = createUserSchema.parse(request.body);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password,
      },
    });

    return reply.status(201).send(user);
  } catch (error) {
    console.log(error);
    if (error instanceof z.ZodError) {
      return reply
        .status(400)
        .send({ error: "Validation Error", details: error.errors });
    }
    reply.status(500).send({ error: "Internal Server Error" });
  }
}

app.post("/users", async (request, reply) => {
  // ... Rest of the user creation logic
});

app.post(
  "/events/:eventId/add-participant",
  {
    preHandler: [verifyJWT, ensureAdminOrManager],
  },
  async (request, reply) => {
    // ... Rest of the add participant logic
  }
);

export default app;
