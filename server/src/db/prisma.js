import { PrismaClient } from "@prisma/client";

let activeClient = null;

function getClient() {
  if (!activeClient) {
    activeClient = new PrismaClient();
  }
  return activeClient;
}

export function setPrismaClient(client) {
  if (!client) {
    throw new TypeError("A PrismaClient instance is required.");
  }
  activeClient = client;
}

export function clearPrismaClient(client) {
  if (activeClient === client) {
    activeClient = null;
  }
}

export function getPrismaClient() {
  return getClient();
}

export const prisma = new Proxy(
  {},
  {
    get(target, prop) {
      const client = getClient();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
    set(target, prop, value) {
      const client = getClient();
      client[prop] = value;
      return true;
    },
  }
);
