import { RetrievalIndexCoordinator } from "@reflecta/server";
import { getDBInstance } from "./db";

export const retrievalIndexCoordinator = new RetrievalIndexCoordinator({
  getDb: getDBInstance,
});
