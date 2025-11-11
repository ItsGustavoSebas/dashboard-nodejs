import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Pool de conexiones MySQL (solo lectura para ETL)
// Esta conexión es al sistema principal Spring Boot
let pool = null;

export function getMySQLPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    console.log('✅ MySQL connection pool created');
  }

  return pool;
}

// Función para probar la conexión
export async function testMySQLConnection() {
  try {
    const connection = await getMySQLPool().getConnection();
    console.log('✅ MySQL connection test successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL connection test failed:', error.message);
    return false;
  }
}

// Función para cerrar el pool (útil para shutdown graceful)
export async function closeMySQLPool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ MySQL connection pool closed');
  }
}

export default getMySQLPool;
