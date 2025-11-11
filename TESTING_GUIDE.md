# 🧪 Testing Guide - Analytics Microservice

Guía completa para probar y validar el microservicio de Analytics.

## 📋 Checklist de Configuración

Antes de empezar las pruebas, asegúrate de que:

- [ ] Las dependencias están instaladas (`npm install`)
- [ ] El archivo `.env` está configurado correctamente
- [ ] Las migraciones de Supabase se ejecutaron exitosamente
- [ ] MySQL está corriendo y accesible
- [ ] La base de datos MySQL tiene datos de prueba
- [ ] Google Gemini API Key está configurada

## 🚀 Paso 1: Iniciar el Servidor

```bash
npm run dev
```

Deberías ver:

```
🚀 ========================================
🚀 Starting Analytics Microservice...
🚀 ========================================

✅ Apollo Server started
✅ Server ready at http://localhost:5000
📊 GraphQL endpoint: http://localhost:5000/graphql
🔌 WebSocket endpoint: ws://localhost:5000/graphql
❤️  Health check: http://localhost:5000/health

⏰ Starting ETL cron job...
✅ ETL cron job started with schedule: 0 * * * *

🚀 ========================================
🚀 Analytics Microservice is running!
🚀 ========================================
```

## 🏥 Paso 2: Health Check

### Usando curl:

```bash
curl http://localhost:5000/health
```

**Respuesta Esperada:**

```json
{
  "status": "OK",
  "timestamp": "2025-11-10T...",
  "services": {
    "apollo": true,
    "supabase": true,
    "mysql": true,
    "websocket": "NO_CLIENTS"
  }
}
```

### Verificación:

- [ ] `status` es "OK"
- [ ] `supabase` es `true`
- [ ] `mysql` es `true`

Si `mysql` es `false`:
- Verifica credenciales en `.env`
- Asegúrate de que MySQL esté corriendo
- Verifica permisos de usuario

## 📊 Paso 3: Acceder a GraphQL Playground

Abre en tu navegador:

```
http://localhost:5000/graphql
```

Deberías ver **Apollo Sandbox** o **Apollo Studio**.

## 🔧 Paso 4: Ejecutar el ETL Manualmente

### Mutation para forzar ETL:

```graphql
mutation {
  triggerETL {
    id
    status
    projects_processed
    sprints_processed
    duration_ms
    started_at
    finished_at
  }
}
```

**Respuesta Esperada:**

```json
{
  "data": {
    "triggerETL": {
      "id": "uuid-here",
      "status": "SUCCESS",
      "projects_processed": 5,
      "sprints_processed": 12,
      "duration_ms": 2345,
      "started_at": "2025-11-10T...",
      "finished_at": "2025-11-10T..."
    }
  }
}
```

### Verificación:

- [ ] `status` es "SUCCESS"
- [ ] `projects_processed` > 0
- [ ] `duration_ms` es un número razonable

Si el ETL falla:
- Revisa los logs en la consola
- Verifica que MySQL tenga datos
- Verifica que las tablas en MySQL existan

## 📈 Paso 5: Consultar KPIs de un Proyecto

### Query para obtener KPIs:

```graphql
query {
  getProjectKPIs(projectId: 1) {
    id
    project_id_source
    project_name
    health_score
    progress_percentage
    velocity
    cycle_time_avg
    lead_time_avg
    blocker_count
    workload_distribution
    last_updated
  }
}
```

**Respuesta Esperada:**

```json
{
  "data": {
    "getProjectKPIs": {
      "id": "uuid-here",
      "project_id_source": 1,
      "project_name": "Proyecto Demo",
      "health_score": 85,
      "progress_percentage": 67.5,
      "velocity": 42,
      "cycle_time_avg": 3.2,
      "lead_time_avg": 5.8,
      "blocker_count": 2,
      "workload_distribution": {
        "Juan Pérez": 12,
        "María García": 8
      },
      "last_updated": "2025-11-10T..."
    }
  }
}
```

### Verificación:

- [ ] Los datos se devuelven correctamente
- [ ] `health_score` está entre 0-100
- [ ] `progress_percentage` está entre 0-100
- [ ] Los tiempos son números positivos

## 🧠 Paso 6: Probar Análisis con IA (Google Gemini)

### Query para análisis inteligente:

```graphql
query {
  getIntelligentAnalysis(projectId: 1) {
    summary
    recommendations
    prediction
    cached
    generated_at
  }
}
```

**Respuesta Esperada:**

```json
{
  "data": {
    "getIntelligentAnalysis": {
      "summary": "El proyecto muestra un buen estado general con un health score de 85/100...",
      "recommendations": [
        "Resolver las 2 tareas bloqueantes identificadas para evitar retrasos",
        "Equilibrar la carga de trabajo entre los miembros del equipo",
        "Mejorar el cycle time reduciendo el tiempo en revisión"
      ],
      "prediction": "El proyecto tiene alta probabilidad de completarse a tiempo...",
      "cached": false,
      "generated_at": "2025-11-10T..."
    }
  }
}
```

### Verificación:

- [ ] `summary` contiene un párrafo coherente
- [ ] `recommendations` tiene 3 elementos
- [ ] `prediction` tiene contenido
- [ ] `cached` es `false` la primera vez, `true` la segunda

Si falla:
- Verifica que `GOOGLE_AI_API_KEY` esté en `.env`
- Verifica que la API Key sea válida
- Revisa los logs de error

## 📊 Paso 7: Crear un Dashboard

### Mutation para crear dashboard:

```graphql
mutation {
  createDashboard(input: {
    name: "Dashboard de Prueba"
    description: "Dashboard para testing"
    is_default: true
  }) {
    id
    name
    description
    is_default
    created_at
  }
}
```

**Nota**: Esta mutation requiere autenticación. Para probar sin autenticación, necesitas:

1. Obtener un token JWT válido
2. Agregarlo en Headers:

```json
{
  "Authorization": "Bearer <tu-token-jwt>"
}
```

O temporalmente, comenta las validaciones de auth en `resolvers.js`.

## 🔌 Paso 8: Probar WebSocket Subscriptions

### Usando GraphQL Playground

1. Abre una nueva pestaña en Apollo Sandbox
2. Cambia el protocolo a WebSocket (`ws://localhost:5000/graphql`)
3. Ejecuta la subscription:

```graphql
subscription {
  onAnyProjectKPIsUpdated {
    project_id_source
    project_name
    health_score
    progress_percentage
  }
}
```

4. En otra pestaña, ejecuta el ETL manualmente:

```graphql
mutation {
  triggerETL {
    status
  }
}
```

5. Deberías ver actualizaciones en la pestaña de subscription

### Verificación:

- [ ] La subscription se conecta exitosamente
- [ ] Se reciben eventos cuando el ETL termina
- [ ] Los datos llegan en tiempo real

## 📝 Paso 9: Verificar Logs del ETL

### Query para ver logs:

```graphql
query {
  getETLLogs(limit: 5) {
    id
    status
    projects_processed
    sprints_processed
    duration_ms
    error_message
    started_at
    finished_at
  }
}
```

**Respuesta Esperada:**

```json
{
  "data": {
    "getETLLogs": [
      {
        "id": "uuid-1",
        "status": "SUCCESS",
        "projects_processed": 5,
        "sprints_processed": 12,
        "duration_ms": 2345,
        "error_message": null,
        "started_at": "2025-11-10T10:00:00Z",
        "finished_at": "2025-11-10T10:00:02Z"
      },
      // ... más logs
    ]
  }
}
```

### Verificación:

- [ ] Se muestran logs del ETL
- [ ] Los logs más recientes aparecen primero
- [ ] `status` es "SUCCESS" en la mayoría

## 🔍 Paso 10: Queries Adicionales de Testing

### Obtener múltiples proyectos:

```graphql
query {
  getAllProjectKPIs(limit: 10, offset: 0) {
    project_id_source
    project_name
    health_score
    progress_percentage
  }
}
```

### Obtener resumen de KPIs:

```graphql
query {
  getKPISummary {
    total_projects
    average_health_score
    total_blockers
    projects_at_risk
  }
}
```

### Obtener KPIs de un sprint:

```graphql
query {
  getSprintKPIs(sprintId: 1) {
    sprint_id_source
    sprint_name
    velocity
    tasks_completed
    completion_percentage
  }
}
```

## 🐛 Debugging Común

### Error: "Not authenticated"

**Solución**: Agrega un token JWT en los headers:

```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

O temporalmente, comenta la verificación de auth en `resolvers.js`.

### Error: "Project with ID X not found"

**Solución**:
1. Ejecuta el ETL manualmente primero
2. Verifica que el proyecto existe en MySQL
3. Usa un `projectId` válido de tu base de datos

### Error: "MySQL connection failed"

**Solución**:
1. Verifica que MySQL esté corriendo: `mysql -u root -p`
2. Verifica credenciales en `.env`
3. Verifica permisos: `GRANT SELECT ON *.* TO 'user'@'localhost';`

### Error: "GOOGLE_AI_API_KEY is not configured"

**Solución**:
1. Obtén una API Key en [Google AI Studio](https://aistudio.google.com)
2. Agrégala a `.env`: `GOOGLE_AI_API_KEY=tu_key_aqui`
3. Reinicia el servidor

## ✅ Checklist Final

Después de completar todas las pruebas:

- [ ] El servidor inicia sin errores
- [ ] Health check retorna "OK"
- [ ] ETL se ejecuta exitosamente
- [ ] Se pueden consultar KPIs de proyectos
- [ ] Análisis de IA funciona (Google Gemini)
- [ ] Los logs del ETL se guardan correctamente
- [ ] WebSocket subscriptions funcionan
- [ ] Todas las queries principales funcionan

## 📊 Performance Testing

### Test de carga del ETL:

Ejecuta el ETL varias veces seguidas y mide el tiempo:

```bash
for i in {1..5}; do
  echo "Run $i"
  curl -X POST http://localhost:5000/graphql \
    -H "Content-Type: application/json" \
    -d '{"query": "mutation { triggerETL { duration_ms } }"}'
  echo ""
done
```

### Verificación:

- [ ] El tiempo de ejecución es consistente
- [ ] No hay memory leaks
- [ ] Las conexiones MySQL se cierran correctamente

## 🎉 ¡Testing Completo!

Si todas las pruebas pasaron:
- ✅ El microservicio está funcionando correctamente
- ✅ Todas las integraciones están OK
- ✅ Listo para desarrollo frontend

**Siguiente paso**: Integrar con el frontend Angular usando Apollo Client.

## 📚 Referencias

- [Documentación Principal](./README.md)
- [Schema GraphQL](./graphql/schema.graphql)
- [Migraciones](./migrations/README.md)
