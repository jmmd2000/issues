import { db } from "../db";
import { STATUS_CATEGORIES } from "../db/schema";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type StatusCategory = (typeof STATUS_CATEGORIES)[number];
