// src/utils/jwtUtils.ts

import jwt from "jsonwebtoken";

export const JWT_SECRET = "your_jwt_secret"; // Deve ser armazenado de forma segura

// Função para gerar um token JWT
export const generateJWT = (data: any) => {
  return jwt.sign(data, JWT_SECRET, {
    expiresIn: "1h",
  });
};
