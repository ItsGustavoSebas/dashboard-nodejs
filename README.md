# 📊 Analytics Microservice - Dashboard de KPIs con IA

Microservicio backend independiente que proporciona KPIs automáticos, dashboards personalizables y análisis inteligentes con IA (Google Gemini) para aplicaciones de gestión de proyectos ágiles (Scrum/Kanban).

## 🚀 Características

- ✅ **KPIs Automáticos**: 13 KPIs predefinidos calculados automáticamente
- ✅ **GraphQL API**: Queries, Mutations y Subscriptions en tiempo real
- ✅ **Análisis con IA**: Reportes inteligentes generados por Google Gemini
- ✅ **Dashboards Personalizables**: Sistema de widgets configurables
- ✅ **ETL Programado**: Proceso automático cada hora con node-cron
- ✅ **Real-time Updates**: WebSocket para actualizaciones en vivo
- ✅ **Arquitectura de Microservicio**: Independiente del sistema principal

## 📋 Stack Tecnológico

- **Backend**: Node.js + ES Modules
- **API**: Apollo Server 4 (GraphQL)
- **Base de Datos**:
  - PostgreSQL (Supabase) - BD del microservicio
  - MySQL - BD del sistema principal (solo lectura)
- **IA**: Google Gemini (gemini-2.5-flash)
- **Cron**: node-cron para trabajos ETL
- **WebSocket**: graphql-ws para subscriptions

## 📁 Estructura del Proyecto

```
nodejs-supabase/
├── config/
│   ├── supabaseClient.js    # Cliente de Supabase
│   ├── mysqlClient.js        # Pool de conexiones MySQL
│   └── geminiClient.js       # Cliente de Google Gemini
├── graphql/
│   ├── schema.graphql        # Schema GraphQL completo
│   ├── resolvers.js          # Resolvers (Queries, Mutations, Subscriptions)
│   ├── scalars.js            # Custom scalars (JSON, DateTime)
│   └── pubsub.js             # PubSub para subscriptions
├── jobs/
│   └── etl.js                # Script ETL con node-cron
├── migrations/
│   ├── 001_initial_schema.sql
│   └── README.md
├── index.js                  # Servidor principal
├── package.json
├── .env
└── README.md
```

## 🔧 Configuración

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Copia `.example.env` a `.env` y configura tus credenciales:

```env
# Server
PORT=5000
NODE_ENV=development

# Supabase (Microservice Database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key

# MySQL (External Source - READ ONLY)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=proyecto_management

# Google Gemini AI
GOOGLE_AI_API_KEY=your_google_gemini_api_key

# JWT Authentication
JWT_SECRET=your_jwt_secret

# ETL Configuration
ETL_CRON_SCHEDULE=0 * * * *  # Every hour
```

### 3. Ejecutar Migraciones de Base de Datos

Ejecuta el script SQL en Supabase Dashboard:

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Abre el **SQL Editor**
3. Copia y pega el contenido de `migrations/001_initial_schema.sql`
4. Ejecuta el script

Ver más detalles en `migrations/README.md`.

### 4. Iniciar el Servidor

```bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start
```

El servidor estará disponible en:
- 📊 GraphQL API: `http://localhost:5000/graphql`
- 🔌 WebSocket: `ws://localhost:5000/graphql`
- ❤️ Health Check: `http://localhost:5000/health`

## 📊 KPIs Calculados

El ETL calcula automáticamente los siguientes KPIs:

### Por Proyecto
1. **Health Score** (0-100): Salud general del proyecto
2. **Progress Percentage**: Porcentaje de tareas completadas
3. **Velocity**: Puntos de historia completados en el último sprint
4. **Cycle Time Avg**: Tiempo promedio de "En Progreso" a "Hecho"
5. **Lead Time Avg**: Tiempo promedio de creación a "Hecho"
6. **Blocker Count**: Número de tareas bloqueantes activas
7. **Workload Distribution**: Distribución de tareas por usuario

### Por Sprint
1. **Velocity**: Puntos completados en el sprint
2. **Tasks Completed**: Número de tareas completadas
3. **Story Points Completed**: Puntos de historia completados
4. **Completion Percentage**: Porcentaje de completado

## 🔥 API GraphQL

### Queries Principales

```graphql
# Obtener KPIs de un proyecto
query {
  getProjectKPIs(projectId: 1) {
    project_name
    health_score
    progress_percentage
    velocity
    cycle_time_avg
    lead_time_avg
    blocker_count
    workload_distribution
  }
}

# Obtener análisis inteligente con IA
query {
  getIntelligentAnalysis(projectId: 1) {
    summary
    recommendations
    prediction
  }
}

# Obtener dashboards del usuario
query {
  getMyDashboards {
    id
    name
    layout
    widgets {
      kpi_key
      component_type
      config
    }
  }
}
```

### Mutations Principales

```graphql
# Crear un dashboard
mutation {
  createDashboard(input: {
    name: "Mi Dashboard"
    description: "Dashboard principal"
    is_default: true
  }) {
    id
    name
  }
}

# Agregar widget a dashboard
mutation {
  addWidget(input: {
    dashboard_id: "uuid-here"
    kpi_key: "health_score"
    component_type: GAUGE
    config: { threshold: 70, color: "#3B82F6" }
  }) {
    id
    kpi_key
  }
}

# Forzar ejecución del ETL
mutation {
  triggerETL {
    status
    projects_processed
    duration_ms
  }
}
```

### Subscriptions (WebSocket)

```graphql
# Suscribirse a actualizaciones de KPIs de un proyecto
subscription {
  onProjectKPIsUpdated(projectId: 1) {
    project_name
    health_score
    progress_percentage
  }
}

# Suscribirse a cambios en el ETL
subscription {
  onETLStatusChange {
    status
    projects_processed
    finished_at
  }
}
```

## 🤖 Análisis con IA (Google Gemini)

El microservicio integra Google Gemini para generar análisis inteligentes:

1. **Resumen Ejecutivo**: Evaluación de la salud del proyecto
2. **Recomendaciones**: 3 acciones concretas para mejorar
3. **Predicción**: Si el proyecto terminará a tiempo

**Ejemplo de Uso:**

```graphql
query {
  getIntelligentAnalysis(projectId: 1) {
    summary
    recommendations
    prediction
    cached
  }
}
```

**Cache**: Los análisis se cachean por 24 horas para evitar llamadas repetidas a la API.

## ⏰ Proceso ETL

### Funcionamiento

1. **Extracción**: Lee datos de MySQL (proyectos, sprints, tareas, historial)
2. **Transformación**: Calcula todos los KPIs
3. **Carga**: Guarda en Supabase (upsert)
4. **Notificación**: Publica eventos para subscriptions

### Programación

- **Automático**: Cada hora (configurable en `.env`)
- **Manual**: Vía mutation `triggerETL`

### Monitoreo

```graphql
query {
  getETLLogs(limit: 10) {
    status
    projects_processed
    duration_ms
    started_at
    finished_at
  }
}
```

## 🔐 Autenticación

El microservicio soporta dos métodos de autenticación:

### Opción 1: JWT Estándar (Actual)

```http
Authorization: Bearer <your-jwt-token>
```

### Opción 2: Supabase Auth

Para usar Supabase Auth, edita `index.js`:

```javascript
// Descomentar en la función getUser():
const { data: { user }, error } = await supabase.auth.getUser(cleanToken);
```

## 🧪 Testing

### Health Check

```bash
curl http://localhost:5000/health
```

### GraphQL Query (con curl)

```bash
curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ getProjectKPIs(projectId: 1) { health_score } }"}'
```

### Forzar ETL Manualmente

```bash
curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { triggerETL { status } }"}'
```

## 📚 Documentación Adicional

- [Migraciones de Base de Datos](./migrations/README.md)
- [Schema GraphQL](./graphql/schema.graphql)
- [Configuración ETL](./jobs/etl.js)

## 🔄 Flujo de Datos

```
┌─────────────┐       ┌──────────────┐       ┌────────────┐
│   MySQL     │──ETL──▶│   Supabase   │◀─────▶│  GraphQL   │
│  (Sistema   │       │ (Microservicio│       │    API     │
│  Principal) │       │   Database)   │       └────────────┘
└─────────────┘       └──────────────┘              │
                             │                      │
                             │                      ▼
                             ▼               ┌─────────────┐
                      ┌─────────────┐       │   Angular   │
                      │  Google     │       │   Frontend  │
                      │   Gemini    │       │  (Cliente)  │
                      └─────────────┘       └─────────────┘
```

## 🛠️ Comandos Útiles

```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Modo producción
npm start

# Verificar health
curl http://localhost:5000/health

# Ver logs del ETL
# (en GraphQL Playground)
query { getETLLogs { status projects_processed } }
```

## 🐛 Troubleshooting

### Error: "MySQL connection failed"

- Verifica credenciales en `.env`
- Asegúrate de que MySQL esté corriendo
- Verifica que el usuario tenga permisos de lectura

### Error: "GOOGLE_AI_API_KEY is not configured"

- Agrega tu API Key de Google Gemini en `.env`
- Obtén una en [Google AI Studio](https://aistudio.google.com)

### Error: "No se pueden crear tablas en Supabase"

- Ejecuta las migraciones desde el SQL Editor de Supabase
- Verifica que tengas permisos de administrador

### ETL no se ejecuta automáticamente

- Verifica que el servidor esté corriendo
- Revisa el formato del cron schedule en `.env`
- Usa `getETLCronStatus` para verificar el estado

## 📝 Notas Importantes

- ⚠️ **NO modifiques** la base de datos MySQL desde este microservicio
- ⚠️ La conexión a MySQL es **solo lectura** (para el ETL)
- ⚠️ Configura correctamente las credenciales de Supabase y MySQL
- ⚠️ El ETL se ejecuta automáticamente cada hora
- ⚠️ Los análisis de IA se cachean por 24 horas

## 📄 Licencia

MIT

## 👥 Autor

Manthan Ankolekar

---

**¿Necesitas ayuda?** Abre un issue en el repositorio o consulta la documentación de:
- [Apollo Server](https://www.apollographql.com/docs/apollo-server/)
- [Supabase](https://supabase.com/docs)
- [Google Gemini](https://ai.google.dev/docs)
