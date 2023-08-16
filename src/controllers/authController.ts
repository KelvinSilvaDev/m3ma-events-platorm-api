// src/controllers/authController.ts
import { FastifyInstance } from "fastify";
import fastify, { FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { PrismaClient } from "@prisma/client";
// import jwt from "@fastify/jwt";
import fastifyJwt from "@fastify/jwt";
import { JWT_SECRET } from "../utils/jwtUtils";

const prisma = new PrismaClient();

interface RegisterRequestBody {
  name: string;
  email: string;
  password: string;
}

const registerUser = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { name, email, password } = request.body as RegisterRequestBody;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    return reply
      .status(201)
      .send({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

const loginUser = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { email, password } = request.body as RegisterRequestBody;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(400).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return reply.status(400).send({ error: "Invalid email or password" });
    }

    // Generate JWT and send it in the response
    const token = jwt.sign(
      { userId: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );
    return reply.send({ token });
    // ...
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

export { registerUser, loginUser };
