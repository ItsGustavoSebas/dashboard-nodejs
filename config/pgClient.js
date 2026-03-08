import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Pool de conexiones PostgreSQL (solo lectura para ETL)
// Esta conexión es al sistema principal Spring Boot
let pool = null;

export function getPGPool() {
  if (!pool) {
    const { Pool } = pg;
    pool = new Pool({
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT) || 5432,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    console.log('✅ PostgreSQL connection pool created');
  }

  return pool;
}

// Función para probar la conexión
export async function testPGConnection() {
  try {
    const client = await getPGPool().connect();
    console.log('✅ PostgreSQL connection test successful');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection test failed:', error.message);
    return false;
  }
}

// Función para cerrar el pool (útil para shutdown graceful)
export async function closePGPool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ PostgreSQL connection pool closed');
  }
}

export default getPGPool;
