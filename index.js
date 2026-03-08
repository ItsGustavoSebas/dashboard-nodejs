import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';

// Importar configuraciones y resolvers
import supabase from './config/supabaseClient.js';
import { testPGConnection } from './config/pgClient.js';
import resolvers from './graphql/resolvers.js';
import { startETLCron } from './jobs/etl.js';

// Configurar __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config();

// =====================================================
// CONFIGURACIÓN
// =====================================================

const PORT = parseInt(process.env.PORT, 10) || 8080; // usar 8080 como fallback por Cloud Run
const HOST = '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';

// =====================================================
// CARGAR SCHEMA GRAPHQL
// =====================================================

const typeDefs = readFileSync(
  join(__dirname, 'graphql', 'schema.graphql'),
  'utf-8'
);

const schema = makeExecutableSchema({ typeDefs, resolvers });

// =====================================================
// FUNCIÓN DE CONTEXTO (AUTENTICACIÓN)
// =====================================================

/**
 * Extraer y validar el token JWT del header Authorization
 */
async function getUser(token) {
  if (!token) return null;

  try {
    // Remover 'Bearer ' del token si existe
    const cleanToken = token.replace('Bearer ', '');

    // Opción 1: Usar JWT estándar (si tu sistema principal usa JWT)
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
    return decoded;

    // Opción 2: Usar Supabase Auth (descomenta si usas Supabase Auth)
    /*
    const { data: { user }, error } = await supabase.auth.getUser(cleanToken);
    if (error) return null;
    return user;
    */
  } catch (error) {
    console.error('Error verifying token:', error.message);
    return null;
  }
}

/**
 * Crear contexto para cada request
 */
async function createContext({ req }) {
  const token = req.headers.authorization || '';
  const user = await getUser(token);

  return {
    user,
    supabase,
  };
}

/**
 * Contexto para WebSocket (subscriptions)
 */
async function createWSContext(ctx) {
  const token = ctx.connectionParams?.authorization || '';
  const user = await getUser(token);

  return {
    user,
    supabase,
  };
}

// =====================================================
// CONFIGURAR EXPRESS Y APOLLO SERVER
// =====================================================

const app = express();
const httpServer = createServer(app);

// WebSocket Server para subscriptions
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

// Configurar graphql-ws
const serverCleanup = useServer(
  {
    schema,
    context: createWSContext,
    onConnect: async (ctx) => {
      console.log('🔌 WebSocket client connected');
    },
    onDisconnect: () => {
      console.log('🔌 WebSocket client disconnected');
    },
  },
  wsServer
);

// Crear Apollo Server
const server = new ApolloServer({
  schema,
  plugins: [
    // Plugin para graceful shutdown
    ApolloServerPluginDrainHttpServer({ httpServer }),
    // Plugin para cleanup de WebSocket
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
  formatError: (error) => {
    console.error('❌ GraphQL Error:', error);
    return {
      message: error.message,
      code: error.extensions?.code,
      path: error.path,
    };
  },
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

async function startServer() {
  console.log('\n🚀 ========================================');
  console.log('🚀 Starting Analytics Microservice...');
  console.log('🚀 ========================================\n');

  try {
    // 1. Iniciar Apollo Server
    await server.start();
    console.log('✅ Apollo Server started');

    // 2. Configurar middleware
    app.use(cors());
    app.use(bodyParser.json());

    // 3. Montar GraphQL endpoint
    app.use(
      '/graphql',
      expressMiddleware(server, {
        context: createContext,
      })
    );

    // 4. Health check endpoint
    app.get('/health', async (req, res) => {
      try {
        const pgOk = await testPGConnection();

        res.json({
          status: 'OK',
          timestamp: new Date().toISOString(),
          services: {
            apollo: true,
            supabase: true,
            pg: pgOk,
            websocket: wsServer.clients.size > 0 ? 'CONNECTED' : 'NO_CLIENTS',
          },
        });
      } catch (error) {
        res.status(500).json({
          status: 'ERROR',
          error: error.message,
        });
      }
    });

    // 5. Root endpoint
    app.get('/', (req, res) => {
      res.json({
        name: 'Analytics Microservice',
        version: '1.0.0',
        description: 'Dashboard de KPIs con IA (GraphQL API)',
        endpoints: {
          graphql: `http://localhost:${PORT}/graphql`,
          health: `http://localhost:${PORT}/health`,
          playground: `http://localhost:${PORT}/graphql`,
        },
        features: [
          'KPIs Automáticos',
          'Dashboards Personalizables',
          'Análisis con IA (Google Gemini)',
          'Real-time Subscriptions',
          'ETL Programado',
        ],
      });
    });

    // 6. Iniciar servidor HTTP
    await new Promise((resolve, reject) => {
      httpServer.listen(PORT, HOST, (err) => {
        if (err) {
          console.error('❌ Error starting httpServer.listen:', err);
          return reject(err);
        }
        console.log(`\n✅ Server listening on ${HOST}:${PORT}`);
        return resolve();
      });
    });


    console.log(`\n✅ Server ready at http://localhost:${PORT}`);
    console.log(`📊 GraphQL endpoint: http://localhost:${PORT}/graphql`);
    console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/graphql`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);

    // 7. Iniciar el cron job del ETL
    console.log('\n⏰ Starting ETL cron job...');
    startETLCron();

    console.log('\n🚀 ========================================');
    console.log('🚀 Analytics Microservice is running!');
    console.log('🚀 ========================================\n');
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

// Manejar shutdown graceful
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  await server.stop();
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  await server.stop();
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Iniciar el servidor
startServer();
