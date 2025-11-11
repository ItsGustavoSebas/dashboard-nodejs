-- =====================================================
-- ANALYTICS MICROSERVICE - SUPABASE DATABASE SCHEMA
-- =====================================================
-- Este schema es para la base de datos del microservicio (Supabase)
-- NO modifica la base de datos MySQL del sistema principal
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsquedas de texto

-- =====================================================
-- TABLA: project_kpis
-- Snapshots de KPIs calculados por el ETL
-- =====================================================
CREATE TABLE IF NOT EXISTS project_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id_source INT UNIQUE NOT NULL, -- ID del proyecto en MySQL
    project_name TEXT,

    -- KPIs principales
    health_score INT CHECK (health_score >= 0 AND health_score <= 100),
    progress_percentage FLOAT CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    velocity INT DEFAULT 0,
    cycle_time_avg FLOAT DEFAULT 0, -- En días
    lead_time_avg FLOAT DEFAULT 0, -- En días
    blocker_count INT DEFAULT 0,

    -- Distribución de carga de trabajo (JSON)
    workload_distribution JSONB DEFAULT '{}',

    -- Metadatos
    last_updated TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc'),
    created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc')
);

-- Índices para project_kpis
CREATE INDEX idx_project_kpis_source_id ON project_kpis(project_id_source);
CREATE INDEX idx_project_kpis_health ON project_kpis(health_score);
CREATE INDEX idx_project_kpis_updated ON project_kpis(last_updated DESC);

-- =====================================================
-- TABLA: sprint_kpis
-- KPIs específicos por sprint
-- =====================================================
CREATE TABLE IF NOT EXISTS sprint_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id_source INT UNIQUE NOT NULL, -- ID del sprint en MySQL
    project_id_source INT NOT NULL,
    sprint_name TEXT,

    -- KPIs del sprint
    velocity INT DEFAULT 0,
    tasks_completed INT DEFAULT 0,
    story_points_completed INT DEFAULT 0,
    tasks_total INT DEFAULT 0,
    completion_percentage FLOAT DEFAULT 0,

    -- Tiempos
    cycle_time_avg FLOAT DEFAULT 0,
    lead_time_avg FLOAT DEFAULT 0,

    -- Estado del sprint
    sprint_status TEXT, -- 'ACTIVE', 'COMPLETED', 'PLANNED'
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,

    -- Metadatos
    last_updated TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc'),
    created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc')
);

-- Índices para sprint_kpis
CREATE INDEX idx_sprint_kpis_source_id ON sprint_kpis(sprint_id_source);
CREATE INDEX idx_sprint_kpis_project ON sprint_kpis(project_id_source);
CREATE INDEX idx_sprint_kpis_status ON sprint_kpis(sprint_status);
CREATE INDEX idx_sprint_kpis_dates ON sprint_kpis(start_date, end_date);

-- =====================================================
-- TABLA: dashboards
-- Dashboards personalizados por usuario
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- ID del usuario (Supabase Auth)
    name TEXT NOT NULL,
    description TEXT,

    -- Layout configuración (para react-grid-layout o similar)
    layout JSONB DEFAULT '{}',
    -- Ejemplo: { "lg": [...], "md": [...], "sm": [...] }

    -- Configuración adicional
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,

    -- Metadatos
    created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc'),
    updated_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc')
);

-- Índices para dashboards
CREATE INDEX idx_dashboards_user ON dashboards(user_id);
CREATE INDEX idx_dashboards_default ON dashboards(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_dashboards_created ON dashboards(created_at DESC);

-- =====================================================
-- TABLA: widgets
-- Widgets individuales de los dashboards
-- =====================================================
CREATE TABLE IF NOT EXISTS widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,

    -- Tipo de KPI a mostrar
    kpi_key TEXT NOT NULL,
    -- Ejemplos: "health_score", "velocity", "cycle_time_avg", "blocker_count"

    -- Tipo de componente visual
    component_type TEXT NOT NULL,
    -- Ejemplos: "gauge", "line_chart", "bar_chart", "number", "table", "pie_chart"

    -- Configuración específica del widget
    config JSONB DEFAULT '{}',
    -- Ejemplo: { "color": "#3B82F6", "threshold": 80, "showTrend": true }

    -- Posición y tamaño
    position JSONB DEFAULT '{}',
    -- Ejemplo: { "x": 0, "y": 0, "w": 4, "h": 3 }

    -- Filtros específicos (opcional)
    filters JSONB DEFAULT '{}',
    -- Ejemplo: { "project_id": 123, "date_range": "last_30_days" }

    -- Metadatos
    created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc'),
    updated_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc')
);

-- Índices para widgets
CREATE INDEX idx_widgets_dashboard ON widgets(dashboard_id);
CREATE INDEX idx_widgets_kpi_key ON widgets(kpi_key);
CREATE INDEX idx_widgets_component_type ON widgets(component_type);

-- =====================================================
-- TABLA: ai_analysis_cache
-- Cache de análisis de IA para evitar llamadas repetidas
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_analysis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id_source INT NOT NULL,

    -- Contenido del análisis de IA
    summary TEXT NOT NULL,
    recommendations JSONB DEFAULT '[]', -- Array de strings
    prediction TEXT,

    -- KPIs en el momento del análisis (para tracking)
    kpis_snapshot JSONB DEFAULT '{}',

    -- Control de cache
    expires_at TIMESTAMPTZ,
    is_valid BOOLEAN DEFAULT true,

    -- Metadatos
    created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc')
);

-- Índices para ai_analysis_cache
CREATE INDEX idx_ai_cache_project ON ai_analysis_cache(project_id_source);
CREATE INDEX idx_ai_cache_valid ON ai_analysis_cache(project_id_source, is_valid) WHERE is_valid = true;
CREATE INDEX idx_ai_cache_expires ON ai_analysis_cache(expires_at);

-- =====================================================
-- TABLA: etl_logs
-- Logs de ejecución del ETL para monitoreo
-- =====================================================
CREATE TABLE IF NOT EXISTS etl_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Estado de la ejecución
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'RUNNING'

    -- Estadísticas
    projects_processed INT DEFAULT 0,
    sprints_processed INT DEFAULT 0,
    duration_ms INT,

    -- Errores (si los hay)
    error_message TEXT,
    error_stack TEXT,

    -- Timestamp
    started_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc'),
    finished_at TIMESTAMPTZ
);

-- Índices para etl_logs
CREATE INDEX idx_etl_logs_status ON etl_logs(status);
CREATE INDEX idx_etl_logs_started ON etl_logs(started_at DESC);

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = (now() AT TIME ZONE 'utc');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para dashboards
CREATE TRIGGER update_dashboards_updated_at
    BEFORE UPDATE ON dashboards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para widgets
CREATE TRIGGER update_widgets_updated_at
    BEFORE UPDATE ON widgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - Para Supabase
-- =====================================================

-- Habilitar RLS en las tablas de usuarios
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;

-- Políticas para dashboards
CREATE POLICY "Users can view their own dashboards"
    ON dashboards FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dashboards"
    ON dashboards FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards"
    ON dashboards FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards"
    ON dashboards FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para widgets (heredan del dashboard)
CREATE POLICY "Users can view widgets of their dashboards"
    ON widgets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM dashboards
            WHERE dashboards.id = widgets.dashboard_id
            AND dashboards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create widgets in their dashboards"
    ON widgets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM dashboards
            WHERE dashboards.id = widgets.dashboard_id
            AND dashboards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update widgets in their dashboards"
    ON widgets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM dashboards
            WHERE dashboards.id = widgets.dashboard_id
            AND dashboards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete widgets in their dashboards"
    ON widgets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM dashboards
            WHERE dashboards.id = widgets.dashboard_id
            AND dashboards.user_id = auth.uid()
        )
    );

-- =====================================================
-- COMENTARIOS EN TABLAS Y COLUMNAS
-- =====================================================

COMMENT ON TABLE project_kpis IS 'Snapshots de KPIs calculados por el ETL desde la base de datos MySQL';
COMMENT ON TABLE sprint_kpis IS 'KPIs específicos por sprint';
COMMENT ON TABLE dashboards IS 'Dashboards personalizados por usuario';
COMMENT ON TABLE widgets IS 'Widgets configurables de los dashboards';
COMMENT ON TABLE ai_analysis_cache IS 'Cache de análisis generados por IA';
COMMENT ON TABLE etl_logs IS 'Logs de ejecución del proceso ETL';

COMMENT ON COLUMN project_kpis.project_id_source IS 'ID del proyecto en la base de datos MySQL (solo referencia)';
COMMENT ON COLUMN project_kpis.health_score IS 'Puntuación de salud del proyecto (0-100)';
COMMENT ON COLUMN project_kpis.workload_distribution IS 'Distribución de tareas por usuario en formato JSON';

-- =====================================================
-- DATOS DE EJEMPLO (OPCIONAL - COMENTAR EN PRODUCCIÓN)
-- =====================================================

-- Insertar un dashboard de ejemplo (necesita un user_id válido de Supabase Auth)
-- INSERT INTO dashboards (user_id, name, description, is_default) VALUES
-- ('00000000-0000-0000-0000-000000000000', 'Dashboard Principal', 'Dashboard predeterminado con KPIs generales', true);

-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
