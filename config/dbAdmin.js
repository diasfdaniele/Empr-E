import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL) {
    throw new Error(
        'A variável SUPABASE_URL não foi configurada.'
    );
}

if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error(
        'A variável SUPABASE_SECRET_KEY não foi configurada.'
    );
}

export const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);