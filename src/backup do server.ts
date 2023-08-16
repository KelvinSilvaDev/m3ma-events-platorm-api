import fastify, {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  RouteGenericInterface,
} from "fastify";
import bcrypt from "bcryptjs";
import multipart from "fastify-multipart";
import jwt from "jsonwebtoken";
import fastifyCors from "@fastify/cors";
import { pipeline } from "stream";
import { promisify } from "util";
import { join } from "path";
import { createWriteStream } from "fs";

import { Event, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { IncomingMessage, Server } from "http";

// declare module 'fastify' {
//   interface FastifyInstance {
//     post(
//       path: string,
//       opts: any,
//       handler: (request: MultipartFastifyRequest, reply: FastifyReply) => Promise<void>
//     ): void;
//   }
// }

const JWT_SECRET = "your_jwt_secret"; // Você deve armazenar isso de forma segura, preferencialmente em variáveis de ambiente.

const app: FastifyInstance = fastify();

const prisma = new PrismaClient();

app.register(multipart);

app.register(fastifyCors, {
  // Configurações do CORS aqui
  origin: true, // Isso permitirá qualquer origem. Em produção, você deve especificar as origens permitidas.
  credentials: true, // Isso permite que os cookies e os headers de autorização sejam enviados nas solicitações CORS
  // Adicione outras configurações do CORS conforme necessário
});

const ensureAdminOrManager = (request: any, reply: any, next: any) => {
  const userRole = request.user?.role;

  if (userRole === "ADMIN" || userRole === "MANAGER") {
    next();
  } else {
    return reply.status(403).send({ error: "Permission denied." });
  }
};

const verifyJWT = async (request: any, reply: any) => {
  try {
    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply
        .status(401)
        .send({ error: "Authorization token is required" });
    }

    const token = authorization.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    request.user = decoded;

    console.log("Authorization header:", authorization);
    console.log("Extracted token:", token);
    console.log("Decoded JWT:", decoded);

    // console.log(JSON.stringify(request));
    // return reply;
  } catch (error) {
    console.log(error);
    return reply.status(401).send({ error: "Invalid or expired token" });
  }
};

app.get("/privateRoute", { preHandler: verifyJWT }, async (request, reply) => {
  // Esta rota precisa de autenticação.
  // Você pode acessar o usuário autenticado via `request.user`

  return { data: "Private Data!" };
});

app.post("/login", async (request, reply) => {
  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
  });

  try {
    const { email, password } = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(400).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return reply.status(400).send({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );
    return reply.send({ token });
  } catch (error) {
    console.log(error);
    reply.status(500).send({ error: "Internal Server Error" });

    // Handle errors...
  }
});

app.post("/register", async (request, reply) => {
  const createUserSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    password: z.string(),
  });

  try {
    const { name, email, password } = createUserSchema.parse(request.body);

    // Verificar se o usuário com esse e-mail já existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply
        .status(400)
        .send({ error: "E-mail already in use. Please choose another one." });
    }

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
      .send({ user: { id: user.id, name: user.name, email: user.email } }); // Não retorne a senha!
  } catch (error) {
    console.log(error);
    reply.status(500).send({ error: "Internal Server Error" });
  }
});

app.get("/users", async (request, reply) => {
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
});

app.post("/users", async (request, reply) => {
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
});

const createEventSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.string().refine((dateStr) => !isNaN(Date.parse(dateStr)), {
    message: "Invalid date format",
  }),
  price: z.number(),
  participants: z.number().optional(),
});

const saveFile = promisify(pipeline);

interface MultipartFastifyRequest extends FastifyRequest {
  file: () => Promise<{
    fieldname: string;
    filename: string;
    encoding: string;
    mimetype: string;
    file: any;
    fields: any;
  }>;
}

app.post("/debug", async (request, reply) => {
  console.log("Headers:", request.headers);
  console.log("Body:", request.body);
  console.log("Query:", request.query);

  return reply.send({
    headers: request.headers,
    body: request.body,
    query: request.query,
  });
});

app.post(
  "/events",
  {
    preHandler: [verifyJWT, ensureAdminOrManager],
  },
  async (request: any, reply: any) => {
    try {
      const data = await (request as MultipartFastifyRequest).file();
      console.log("Received Full Data: ", data.fields);

      // console.log("Received Data: ", data.fields); // Log dos dados recebidos

      // Verificando e logando qual campo está ausente
      if (!data.fields.title) console.log("Title is missing");
      if (!data.fields.description) console.log("Description is missing");
      if (!data.fields.date) console.log("Date is missing");
      if (!data.fields.price) console.log("Price is missing");

      if (
        !data.fields.title ||
        !data.fields.description ||
        !data.fields.date ||
        !data.fields.price
      ) {
        return reply.status(400).send({ error: "Missing required fields" });
      }

      const extractedData = {
        title: data.fields.title.value,
        description: data.fields.description.value,
        date: data.fields.date.value,
        price: parseFloat(data.fields.price.value),
        participants: data.fields.participants?.value
          ? parseInt(data.fields.participants.value, 10)
          : undefined,
      };
      console.log("Extracted Data: ", extractedData);

      const eventData = createEventSchema.parse(extractedData);
      const pathName = join(__dirname, "uploads", data.filename);
      await saveFile(data.file, createWriteStream(pathName));

      const event = await prisma.event.create({
        data: {
          ...eventData,
          date: new Date(eventData.date),
          participants: eventData.participants || 0,
          image: pathName,
        },
      });

      return reply
        .status(201)
        .send({ message: "Event created successfully!", event });
    } catch (error) {
      console.error(error);

      if (error instanceof z.ZodError) {
        return reply
          .status(400)
          .send({ error: "Validation Error", details: error.errors });
      }

      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }
);

app.get("/events", async (request, reply) => {
  try {
    const events = await prisma.event.findMany();
    reply.status(200).send(events);
  } catch (error) {
    console.log(error);
    reply.status(500).send({ error: "Internal Server Error" });
  }
});

interface RouteParams {
  eventId: string; // Os parâmetros da URL são sempre strings
}

app.get(
  "/events/:eventId",
  async (
    request: FastifyRequest<RouteGenericInterface, Server, IncomingMessage>,
    reply: FastifyReply
  ) => {
    try {
      const { eventId } = request.params as RouteParams; // Use a asserção de tipo aqui
      const numericEventId = Number(eventId); // Converte para número

      const event = await prisma.event.findUnique({
        where: {
          id: numericEventId,
        },
      });

      // Se o evento não foi encontrado
      if (!event) {
        return reply.status(404).send({ error: "Evento não encontrado" });
      }

      // Se encontrou, retorna o evento
      reply.status(200).send(event);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: "Internal Server Error" });
    }
  }
);

app.get("/events/:eventId/get-participants", async (req, res) => {
  try {
    const { eventId } = req.params as RouteParams; // Use a asserção de tipo aqui

    const event = await prisma.event.findUnique({
      where: {
        id: Number(eventId),
      },
      select: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        // select: {
        //   id: true,
        //   name: true,
        //   email: true,
        // },
      },
    });

    console.log(event);

    // Se o evento não foi encontrado
    if (!event) {
      return res.status(404).send({ error: "Evento não encontrado" });
    }

    // Se encontrou, retorna o evento
    res.status(200).send(event);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

app.post(
  "/events/:eventId/add-participant",
  {
    preHandler: [verifyJWT, ensureAdminOrManager],
  },
  async (request: any, reply: FastifyReply) => {
    try {
      const { eventId } = request.params;
      const { userId } = request.body;

      if (!userId) {
        return reply.status(400).send({ error: "User ID is required." });
      }

      const event = await prisma.event.findUnique({
        where: { id: parseInt(eventId) },
        select: {
          participants: true,
          users: {
            where: {
              id: parseInt(userId),
            },
            select: {
              id: true,
            },
          },
        },
      });

      if (!event) {
        return reply.status(404).send({ error: "Event not found." });
      }

      if (event.users && event.users.length > 0) {
        return reply
          .status(400)
          .send({ error: "User is already a participant." });
      }

      // 1. Atualiza a relação entre User e Event.
      await prisma.event.update({
        where: { id: parseInt(eventId) },
        data: {
          users: {
            connect: {
              id: parseInt(userId),
            },
          },
        },
      });

      // 2. (Opcional) Atualizar o campo 'participants' do 'Event'.
      await prisma.event.update({
        where: { id: parseInt(eventId) },
        data: {
          participants: event.participants + 1,
        },
      });

      return reply
        .status(200)
        .send({ message: "Participant added successfully!" });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  }
);

app
  .listen({
    host: "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 3333,
  })
  .then(() => {
    console.log("HTTP Server Running");
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
  });

// Handle gracefully shutting down your application
process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received. Closing Prisma Client.");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT signal received. Closing Prisma Client.");
  await prisma.$disconnect();
  process.exit(0);
});
