/**
 * Zod Schemas for Edge Functions
 * 
 * This file exports only the API request/response schemas needed for Edge Functions validation.
 * It avoids importing entity types which have database dependencies.
 */

// Import Zod (will be resolved via import map to Deno URL)
import { z } from 'zod';

// Re-export Zod for convenience
export { z };

// Only export API schemas which are specifically designed for Edge Functions
// Do NOT export entity types (user, site, plugin, team) as they import from database types
export * from '../../../packages/types/src/api.ts';



