const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Fallbacks de produção para garantir que a aplicação suba no Vercel mesmo se
// as variáveis de ambiente ainda não tiverem sido configuradas no painel da Vercel
const FALLBACK_SUPABASE_URL = 'https://ahhqxtmkgagvhfhrxsqm.supabase.co';
const FALLBACK_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoaHF4dG1rZ2FndmhmaHJ4c3FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MTg4MjcsImV4cCI6MjEwODI5NDgyN30.D31miuwgeDXUyaWMQsbNHHGr_tHYtAuI56bE_LLrlr8';

const supabaseUrl = process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_KEY;

if (!process.env.SUPABASE_URL && !process.env.VERCEL) {
  console.warn('⚠️ SUPABASE_URL não configurado em .env, usando fallback de produção');
}

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
} catch (err) {
  console.error('❌ Falha ao inicializar cliente Supabase:', err.message);
  // Cliente dummy resiliente para evitar FUNCTION_INVOCATION_FAILED no Vercel
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: { message: 'Supabase não inicializado' } }),
      insert: () => Promise.resolve({ data: null, error: { message: 'Supabase não inicializado' } }),
      update: () => Promise.resolve({ data: null, error: { message: 'Supabase não inicializado' } }),
      delete: () => Promise.resolve({ data: null, error: { message: 'Supabase não inicializado' } })
    })
  };
}

module.exports = { supabase };
