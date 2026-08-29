import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// Updated to read the new publishable key variable (falls back to legacy anon key if not set)
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY environment variables.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

/**
 * Express middleware to authenticate requests using Supabase Auth (Publishable Key setup)
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or malformed Authorization header.' });
    }

    const token = authHeader.split(' ')[1];

    // Verify user JWT against Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
    }

    // Attach user payload to request object
    req.user = user;
    next();
  } catch (err) {
    console.error(`[Auth Middleware Error]: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};