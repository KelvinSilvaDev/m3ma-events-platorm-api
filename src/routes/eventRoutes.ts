// src/routes/eventRoutes.ts

import { FastifyInstance } from "fastify";
import {
  deleteAllEventsAndResetID,
  eventsRoutes,
} from "../controllers/eventController";
// import { createEvent, getEvents } from '../controllers/eventController';
// import { eventsRoutes } from './eventsController';

// const eventRoutes = (app: FastifyInstance) => {
//   app.post('/events', createEvent);
//   // app.get('/events', getEvents);
// };

// export default eventRoutes;

export async function setupEventRoutes(app: FastifyInstance) {
  app.register(eventsRoutes);

  app.delete("/reset-events", async (request, reply) => {
    try {
      const result = await deleteAllEventsAndResetID();
      reply.send(result);
    } catch (error) {
      reply.status(500).send({ error: "Erro ao resetar eventos." });
    }
  });
  // You can register more route modules here if needed
}
