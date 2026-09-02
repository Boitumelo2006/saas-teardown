// src/middleware/auth.js
import { supabase } from '../config/supabase.js';

// Rename 'requireAuth' to 'authenticateUser'
export const authenticateUser = async (req, res, next) => {
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