import {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteGenericInterface,
} from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { randomUUID } from "node:crypto";
import { extname, resolve } from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import fileUrl from "file-url";
import { IncomingMessage, Server } from "node:http";

const pump = promisify(pipeline);

interface RouteParams {
  eventId: string; // Os parâmetros da URL são sempre strings
}

export async function deleteAllEventsAndResetID() {
  try {
    // Deletar todos os eventos
    await prisma.event.deleteMany();

    // Reiniciar a sequência de ID para MySQL
    await prisma.$executeRaw`ALTER TABLE Event AUTO_INCREMENT = 1;`;

    return {
      message: "Todos os eventos foram deletados e o ID foi reiniciado.",
    };
  } catch (error) {
    console.error("Erro ao deletar eventos e reiniciar ID:", error);
    throw error;
  }
}

export async function eventsRoutes(app: FastifyInstance) {
  const fs = require("fs");
  const path = require("path");

  app.post("/events", async (request: any, reply: any) => {
    try {
      const bodySchema = z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(),
        price: z.number(),
        participants: z.number().optional(),
      });

      const formData: any = await request.file();
      const formFields = formData.fields; // Fields from the form
      const imageFile = formData.fields.image.file; // Image file stream

      const title = formFields.title.value;
      const description = formFields.description.value;
      const date = new Date(formFields.date.value);
      console.log("Form fields:", formFields);
      console.log("Price field value:", formFields.price.value);
      const price = parseFloat(formFields.price.value);
      // const participants = parseInt(formFields.participants.value);

      console.log("Form data received:", formFields);

      // Handle image upload
      const imageName = `${Date.now()}-${formData.fields.image.filename}`;

      // Obtém o caminho do diretório atual do módulo
      const currentModulePath = fileURLToPath(import.meta.url);
      console.log("Caminho do módulo atual:", currentModulePath);

      const currentModuleDirectory = path.dirname(currentModulePath);
      console.log("Diretório do módulo atual:", currentModuleDirectory);

      // Constrói o caminho absoluto para a pasta de uploads
      const uploadDirectoryPath = path.join(
        currentModuleDirectory,
        "../../public/uploads"
      );
      console.log("Caminho do diretório de upload:", uploadDirectoryPath);

      // Constrói o caminho absoluto para a imagem
      const imagePath = path.join(uploadDirectoryPath, imageName);

      console.log("Caminho da imagem:", imagePath);

      const apiBaseUrl = "http://localhost:3333"; // Verifique a porta

      // Transforma o caminho absoluto em URL
      // const imageUrl = `${apiBaseUrl}${imagePath}`;
      const imageUrl = `/${imageName}`; // Use o nome da imagem

      // const imageUrl = `${request.protocol}://${request.headers.host}${imagePath}`;

      // Save the image file
      const imageStream = fs.createWriteStream(imagePath);
      imageStream.on("error", (err: any) => {
        console.error("Erro ao criar WriteStream:", err);
      });
      imageFile.pipe(imageStream);
      imageStream.on("finish", () => {
        console.log("Upload da imagem concluído com sucesso:", imagePath);
      });
      const event = await prisma.event.create({
        data: {
          title,
          description,
          date,
          price,
          // participants,
          image: imageUrl,
        },
      });

      return event;
    } catch (error) {
      console.error("Error creating event:", error);

      // Return a custom error response
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });

  app.get("/events", async () => {
    const events = await prisma.event.findMany();
    return events;
  });

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

  // You can add other routes like getting a single event, updating, and deleting
}
