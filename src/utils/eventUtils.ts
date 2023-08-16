// src/utils/eventUtils.ts

import { z } from "zod";
import { isValidDate } from "./dateUtils";

export const createEventSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.string().refine(isValidDate, {
    message: "Invalid date format",
  }),
  price: z.number(),
  participants: z.number().optional(),
});
