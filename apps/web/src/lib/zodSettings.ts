import { z } from "zod";

// The CSP blocks eval. Without this, zod tries eval when it builds its first object schema, and the browser logs the blocked attempt.
// Import this module before any module that builds a schema.
z.config({ jitless: true });
