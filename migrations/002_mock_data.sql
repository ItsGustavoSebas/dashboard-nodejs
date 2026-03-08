-- =====================================================
-- ANALYTICS MICROSERVICE - MOCK DATA
-- Sincronizado con DatabaseSeeder (Spring Boot)
-- =====================================================

-- =====================================================
-- 1. project_kpis
-- IDs generados por el backend en Java (1: Atlas, 2: Hermes, 3: Orion)
-- =====================================================
INSERT INTO project_kpis (project_id_source, project_name, health_score, progress_percentage, velocity, cycle_time_avg, lead_time_avg, blocker_count, workload_distribution) VALUES
(1, 'Atlas', 85, 45.5, 32, 4.2, 7.5, 1, '{"user": 20, "ana": 30, "luis": 25, "maria": 25}'),
(2, 'Hermes', 92, 78.0, 45, 3.1, 5.2, 0, '{"user": 10, "ana": 40, "luis": 50}'),
(3, 'Orion', 65, 20.0, 15, 6.5, 12.0, 3, '{"ana": 60, "maria": 40}');

-- =====================================================
-- 2. sprint_kpis
-- IDs generados por el backend en Java 
-- Atlas (Sprints 1 y 2), Hermes (Sprints 3 y 4), Orion (Sprints 5 y 6)
-- =====================================================
INSERT INTO sprint_kpis (sprint_id_source, project_id_source, sprint_name, velocity, tasks_completed, story_points_completed, tasks_total, completion_percentage, cycle_time_avg, lead_time_avg, sprint_status, start_date, end_date) VALUES
-- Proyecto 1: Atlas (Inició hace 50 días)
(1, 1, 'Sprint 1', 25, 12, 25, 15, 80.0, 3.5, 6.0, 'COMPLETED', (now() - interval '50 days'), (now() - interval '36 days')),
(2, 1, 'Sprint 2', 32, 15, 32, 15, 100.0, 3.0, 5.5, 'ACTIVE', (now() - interval '35 days'), (now() - interval '21 days')),

-- Proyecto 2: Hermes (Inició hace 40 días)
(3, 2, 'Sprint 1', 40, 20, 40, 20, 100.0, 2.5, 4.0, 'COMPLETED', (now() - interval '40 days'), (now() - interval '26 days')),
(4, 2, 'Sprint 2', 45, 22, 45, 24, 91.6, 3.0, 5.0, 'ACTIVE', (now() - interval '25 days'), (now() - interval '11 days')),

-- Proyecto 3: Orion (Inició hace 30 días)
(5, 3, 'Sprint 1', 15, 5, 15, 8, 62.5, 6.0, 10.0, 'COMPLETED', (now() - interval '30 days'), (now() - interval '16 days')),
(6, 3, 'Sprint 2', 10, 4, 10, 15, 26.6, 7.5, 14.0, 'ACTIVE', (now() - interval '15 days'), (now() - interval '1 day'));

-- =====================================================
-- 3. dashboards
-- NOTA: Supabase Auth usa UUIDs, así que generamos fijos para asociar
-- Si integras al admin@gmail.com, cambia el UUID por su id en auth.users
-- =====================================================
INSERT INTO dashboards (id, user_id, name, description, is_default, is_public, layout) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'Dashboard Ejecutivo', 'Vista global de todos los proyectos', true, true, '{"lg": [{"i": "widget_1", "x": 0, "y": 0, "w": 4, "h": 2}, {"i": "widget_2", "x": 4, "y": 0, "w": 4, "h": 2}, {"i": "widget_3", "x": 8, "y": 0, "w": 4, "h": 2}]}'),
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'Atlas Métricas', 'Análisis enfocado en el proyecto Atlas.', false, false, '{"lg": [{"i": "widget_4", "x": 0, "y": 0, "w": 6, "h": 4}, {"i": "widget_5", "x": 6, "y": 0, "w": 6, "h": 4}]}'),
('33333333-3333-3333-3333-333333333333', '12345678-1234-1234-1234-1234567890ab', 'Orion Tracker de Retrasos', 'Vista de tiempos de ciclo y bloqueos de Orion.', true, false, '{"lg": [{"i": "widget_6", "x": 0, "y": 0, "w": 3, "h": 2}, {"i": "widget_7", "x": 3, "y": 0, "w": 3, "h": 2}, {"i": "widget_8", "x": 6, "y": 0, "w": 6, "h": 3}]}');

-- =====================================================
-- 4. widgets
-- =====================================================
-- Widgets para 'Dashboard Ejecutivo' (11111111-1111-1111-1111-111111111111)
INSERT INTO widgets (id, dashboard_id, kpi_key, component_type, config, position, filters) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'health_score', 'gauge', '{"color": "#10B981", "threshold": 80, "title": "Salud Promedio Global"}', '{"x": 0, "y": 0, "w": 4, "h": 2}', '{}'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'progress_percentage', 'bar_chart', '{"color": "#3B82F6", "title": "Progreso por Proyecto"}', '{"x": 4, "y": 0, "w": 4, "h": 2}', '{}'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11111111-1111-1111-1111-111111111111', 'blocker_count', 'number', '{"color": "#EF4444", "title": "Bloqueos Totales"}', '{"x": 8, "y": 0, "w": 4, "h": 2}', '{}'),

-- Widgets para 'Atlas Métricas' (22222222-2222-2222-2222-222222222222)
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '22222222-2222-2222-2222-222222222222', 'velocity', 'line_chart', '{"color": "#8B5CF6", "title": "Velocidad Atlas", "showTrend": true}', '{"x": 0, "y": 0, "w": 6, "h": 4}', '{"project_id_source": 1}'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '22222222-2222-2222-2222-222222222222', 'completion_percentage', 'pie_chart', '{"title": "Tasa de Finalización de Tareas (Sprints)"}', '{"x": 6, "y": 0, "w": 6, "h": 4}', '{"project_id_source": 1}'),

-- Widgets para 'Orion Tracker de Retrasos' (33333333-3333-3333-3333-333333333333)
('cccccccc-cccc-cccc-cccc-ccccccccccc1', '33333333-3333-3333-3333-333333333333', 'cycle_time_avg', 'number', '{"title": "Cycle Time Orion (Días)", "format": "0.0"}', '{"x": 0, "y": 0, "w": 3, "h": 2}', '{"project_id_source": 3}'),
('cccccccc-cccc-cccc-cccc-ccccccccccc2', '33333333-3333-3333-3333-333333333333', 'lead_time_avg', 'number', '{"title": "Lead Time Orion (Días)", "format": "0.0"}', '{"x": 3, "y": 0, "w": 3, "h": 2}', '{"project_id_source": 3}'),
('cccccccc-cccc-cccc-cccc-ccccccccccc3', '33333333-3333-3333-3333-333333333333', 'blocker_count', 'table', '{"title": "Orion - Análisis de Retrasos y Bloqueos"}', '{"x": 6, "y": 0, "w": 6, "h": 3}', '{"project_id_source": 3}');

-- =====================================================
-- 5. ai_analysis_cache
-- =====================================================
INSERT INTO ai_analysis_cache (project_id_source, summary, recommendations, prediction, kpis_snapshot, expires_at) VALUES
(1, 'El proyecto Atlas (Plataforma web de proyectos) muestra un rendimiento saludable. La velocidad ha aumentado, y la distribución del equipo (ana, luis, maria) está balanceada.', '["Mantener el ritmo actual", "Revisar backlog del próximo sprint"]', 'Finalizará a tiempo estimado.', '{"health_score": 85, "velocity": 32}', (now() + interval '1 day')),
(2, 'Hermes (Sistema de mensajería) es el proyecto más rápido actualmente. No hay bloqueos registrados y la velocidad es óptima (45 pts).', '["Felicitar al equipo", "Realizar demo al cliente"]', 'El proyecto se completará sin problemas.', '{"health_score": 92, "velocity": 45}', (now() + interval '12 hours')),
(3, 'Alerta roja en Orion (Dashboard de analytics). Existen retrasos y bloqueos (3). El equipo asignado (ana, maria) sugiere un embudo en el desarrollo o tareas excesivas asignadas a los usuarios "flojos".', '["Resolver bloqueos de inmediato", "Redistribuir carga hacia los usuarios más responsables", "Hacer reunión urgente de QA"]', 'Riesgo inminente de incumplimiento de fecha límite.', '{"health_score": 65, "blocker_count": 3}', (now() + interval '1 day'));

-- =====================================================
-- 6. etl_logs
-- =====================================================
INSERT INTO etl_logs (status, projects_processed, sprints_processed, duration_ms, error_message, started_at, finished_at) VALUES
('SUCCESS', 3, 6, 2050, NULL, (now() - interval '2 hours'), (now() - interval '2 hours' + interval '2 seconds')),
('SUCCESS', 3, 6, 1800, NULL, (now() - interval '1 hour'), (now() - interval '1 hour' + interval '1 seconds')),
('FAILED', 0, 0, 1500, 'Error de conexión con la base de datos MySQL (Timeout)', (now() - interval '30 minutes'), (now() - interval '30 minutes' + interval '1 seconds')),
('SUCCESS', 3, 6, 2200, NULL, (now() - interval '5 minutes'), (now() - interval '5 minutes' + interval '2 seconds'));
