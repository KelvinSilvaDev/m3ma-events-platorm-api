// src/utils/dateUtils.ts

export const isValidDate = (dateStr: string) => {
  return !isNaN(Date.parse(dateStr));
};
