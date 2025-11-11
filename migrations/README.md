# Database Migrations

Este directorio contiene las migraciones SQL para la base de datos de Supabase del microservicio de Analytics.

## Cómo Ejecutar las Migraciones

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. Accede a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **SQL Editor** en el menú lateral
3. Copia y pega el contenido de `001_initial_schema.sql`
4. Haz clic en **Run** para ejecutar el script
5. Verifica que todas las tablas se crearon correctamente en la pestaña **Table Editor**

### Opción 2: Usando Supabase CLI

```bash
# Instalar Supabase CLI (si aún no lo tienes)
npm install -g supabase

# Vincular tu proyecto
supabase link --project-ref xxfcgrxbzfgdvqtgqxcp

# Ejecutar la migración
supabase db push
```

### Opción 3: Usando PostgreSQL Client

```bash
psql -h db.xxfcgrxbzfgdvqtgqxcp.supabase.co -U postgres -d postgres -f migrations/001_initial_schema.sql
```

## Estructura de las Tablas

### Tablas Principales

1. **project_kpis** - Snapshots de KPIs calculados por el ETL
   - Almacena: health_score, velocity, cycle_time, lead_time, etc.
   - Actualizada por: ETL cada hora

2. **sprint_kpis** - KPIs específicos por sprint
   - Almacena: velocity, tasks_completed, story_points, etc.
   - Actualizada por: ETL cada hora

3. **dashboards** - Dashboards personalizados por usuario
   - Un usuario puede tener múltiples dashboards
   - Soporta configuración de layout responsive

4. **widgets** - Widgets de los dashboards
   - Cada widget pertenece a un dashboard
   - Configurables: tipo de gráfico, filtros, posición

5. **ai_analysis_cache** - Cache de análisis de IA
   - Evita llamadas repetidas a Google Gemini
   - Expira automáticamente

6. **etl_logs** - Logs de ejecución del ETL
   - Monitoreo y debugging
   - Almacena errores y estadísticas

## Row Level Security (RLS)

Las tablas `dashboards` y `widgets` tienen RLS habilitado para que cada usuario solo pueda acceder a sus propios dashboards.

Las políticas están configuradas automáticamente:
- ✅ Los usuarios solo pueden ver/crear/editar/eliminar sus propios dashboards
- ✅ Los usuarios solo pueden gestionar widgets de sus propios dashboards

## Verificar la Instalación

Después de ejecutar la migración, verifica que todo esté correcto:

```sql
-- Contar las tablas creadas (debe ser 6)
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'project_kpis',
    'sprint_kpis',
    'dashboards',
    'widgets',
    'ai_analysis_cache',
    'etl_logs'
);

-- Verificar índices
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename LIKE '%kpi%' OR tablename = 'dashboards';

-- Verificar RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('dashboards', 'widgets');
```

## Notas Importantes

- **NO modifiques** la base de datos MySQL del sistema principal desde este microservicio
- **Solo lectura** desde MySQL (para el ETL)
- **Lectura/Escritura** en Supabase (para KPIs y dashboards)
- Las políticas RLS requieren que uses Supabase Auth para autenticación
