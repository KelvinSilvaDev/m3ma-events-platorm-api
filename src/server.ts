import fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import multipart from "@fastify/multipart";
import path from "path";
import { authRoutes } from "./routes/authRoutes";
import { setupEventRoutes } from "./routes/eventRoutes";
import { userRoutes } from "./routes/userRoutes";

const app = fastify({ logger: true });

app.register(multipart);

app.register(cors, {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-xsrf-token"], // Adicione o x-xsrf-token aqui
  credentials: true,
});

app.register(jwt, {
  secret: "spacetime", // Replace with your own JWT secret
});

// Ajustando o caminho para o diretório uploads
app.register(fastifyStatic, {
  root: path.join(__dirname, "..", "public", "uploads"),
  prefix: "/public/",
});

userRoutes(app);
authRoutes(app);
setupEventRoutes(app);

app
  .listen({
    port: 3333,
    host: "0.0.0.0",
  })
  .then(() => {
    console.log("🚀 HTTP server running on http://localhost:3333");
  });
