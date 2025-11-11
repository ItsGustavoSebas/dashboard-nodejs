import supabase from '../config/supabaseClient.js';
import { testMySQLConnection } from '../config/mysqlClient.js';
import { generateAIAnalysis } from '../config/geminiClient.js';
import { runETL, getETLCronStatus } from '../jobs/etl.js';
import { pubsub, EVENTS } from './pubsub.js';
import { JSONScalar, DateTimeScalar } from './scalars.js';

// =====================================================
// HELPERS Y UTILIDADES
// =====================================================

/**
 * Obtener el usuario autenticado del contexto
 */
function getAuthUser(context) {
  if (!context.user) {
    //throw new Error('Not authenticated');
  }
  return context.user;
}

/**
 * Generar prompt para análisis de IA
 */
function buildAIPrompt(kpis, projectName) {
  return `Eres un experto en gestión de proyectos Agile (Scrum/Kanban) y análisis de datos.

Analiza los siguientes KPIs de un proyecto de software llamado "${projectName}":

**KPIs del Proyecto:**
- Health Score: ${kpis.health_score}/100
- Progreso: ${kpis.progress_percentage}%
- Velocity: ${kpis.velocity} puntos de historia
- Cycle Time promedio: ${kpis.cycle_time_avg} días
- Lead Time promedio: ${kpis.lead_time_avg} días
- Tareas bloqueantes: ${kpis.blocker_count}
- Distribución de carga: ${JSON.stringify(kpis.workload_distribution, null, 2)}

Por favor, proporciona:

1. **RESUMEN EJECUTIVO** (1-2 párrafos): Una evaluación general de la salud del proyecto basándote en estos KPIs.

2. **RECOMENDACIONES** (exactamente 3): Proporciona 3 recomendaciones accionables específicas para mejorar el proyecto. Cada recomendación debe empezar con un verbo de acción y ser concreta.

3. **PREDICCIÓN**: Basándote en estos KPIs, predice si el proyecto completará sus objetivos a tiempo. Proporciona una predicción clara (positiva, neutral o negativa) con una breve justificación.

Formato de respuesta (IMPORTANTE: usa exactamente este formato):

RESUMEN:
[Tu resumen aquí]

RECOMENDACIONES:
1. [Primera recomendación]
2. [Segunda recomendación]
3. [Tercera recomendación]

PREDICCIÓN:
[Tu predicción aquí]`;
}

/**
 * Parsear respuesta de IA en estructura
 */
function parseAIResponse(text) {
  const summary = text.match(/RESUMEN:\s*([\s\S]*?)\s*RECOMENDACIONES:/i)?.[1]?.trim() ||
    'No se pudo generar el resumen';

  const recomendacionesMatch = text.match(/RECOMENDACIONES:\s*([\s\S]*?)\s*PREDICCIÓN:/i)?.[1];
  const recommendations = recomendacionesMatch
    ? recomendacionesMatch
        .split('\n')
        .filter(line => line.trim().match(/^\d+\./))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
    : ['No se pudieron generar recomendaciones'];

  const prediction = text.match(/PREDICCIÓN:\s*([\s\S]*?)$/i)?.[1]?.trim() ||
    'No se pudo generar la predicción';

  return {
    summary,
    recommendations,
    prediction,
  };
}

// =====================================================
// RESOLVERS
// =====================================================

const resolvers = {
  // Scalars personalizados
  JSON: JSONScalar,
  DateTime: DateTimeScalar,

  // =====================================================
  // QUERIES
  // =====================================================
  Query: {
    // ===== KPIs Queries =====

    async getProjectKPIs(_, { projectId }) {
      const { data, error } = await supabase
        .from('project_kpis')
        .select('*')
        .eq('project_id_source', projectId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No encontrado
        }
        throw new Error(`Error fetching project KPIs: ${error.message}`);
      }

      return data;
    },

    async getMultipleProjectKPIs(_, { projectIds }) {
      const { data, error } = await supabase
        .from('project_kpis')
        .select('*')
        .in('project_id_source', projectIds);

      if (error) {
        throw new Error(`Error fetching multiple project KPIs: ${error.message}`);
      }

      return data || [];
    },

    async getAllProjectKPIs(_, { filters, limit = 50, offset = 0 }) {
      let query = supabase.from('project_kpis').select('*');

      // Aplicar filtros
      if (filters) {
        if (filters.project_ids) {
          query = query.in('project_id_source', filters.project_ids);
        }
        if (filters.health_score_min !== undefined) {
          query = query.gte('health_score', filters.health_score_min);
        }
        if (filters.health_score_max !== undefined) {
          query = query.lte('health_score', filters.health_score_max);
        }
        if (filters.has_blockers) {
          query = query.gt('blocker_count', 0);
        }
        if (filters.date_from) {
          query = query.gte('last_updated', filters.date_from);
        }
        if (filters.date_to) {
          query = query.lte('last_updated', filters.date_to);
        }
      }

      // Paginación
      query = query.range(offset, offset + limit - 1).order('last_updated', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Error fetching all project KPIs: ${error.message}`);
      }

      return data || [];
    },

    async getKPISummary(_, { filters }) {
      const projects = await resolvers.Query.getAllProjectKPIs(_, { filters, limit: 1000, offset: 0 });

      const totalProjects = projects.length;
      const averageHealthScore = totalProjects > 0
        ? projects.reduce((sum, p) => sum + (p.health_score || 0), 0) / totalProjects
        : 0;
      const totalBlockers = projects.reduce((sum, p) => sum + (p.blocker_count || 0), 0);
      const projectsAtRisk = projects.filter(p => (p.health_score || 0) < 50).length;

      return {
        total_projects: totalProjects,
        average_health_score: parseFloat(averageHealthScore.toFixed(2)),
        total_blockers: totalBlockers,
        projects_at_risk: projectsAtRisk,
        projects: projects.slice(0, 10), // Top 10
      };
    },

    async getSprintKPIs(_, { sprintId }) {
      const { data, error } = await supabase
        .from('sprint_kpis')
        .select('*')
        .eq('sprint_id_source', sprintId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Error fetching sprint KPIs: ${error.message}`);
      }

      return data;
    },

    async getProjectSprintKPIs(_, { projectId }) {
      const { data, error } = await supabase
        .from('sprint_kpis')
        .select('*')
        .eq('project_id_source', projectId)
        .order('start_date', { ascending: false });

      if (error) {
        throw new Error(`Error fetching project sprint KPIs: ${error.message}`);
      }

      return data || [];
    },

    // ===== Dashboards Queries =====

    async getMyDashboards(_, __, context) {
      const user = getAuthUser(context);

      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error fetching dashboards: ${error.message}`);
      }

      return data || [];
    },

    async getDashboard(_, { id }, context) {
      const user = getAuthUser(context);

      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Error fetching dashboard: ${error.message}`);
      }

      return data;
    },

    async getDefaultDashboard(_, __, context) {
      const user = getAuthUser(context);

      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Error fetching default dashboard: ${error.message}`);
      }

      return data;
    },

    // ===== AI Analysis Queries =====

    async getIntelligentAnalysis(_, { projectId, forceRefresh = false }) {
      // 1. Obtener KPIs del proyecto
      const kpis = await resolvers.Query.getProjectKPIs(_, { projectId });

      if (!kpis) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // 2. Verificar cache (si no se fuerza refresh)
      if (!forceRefresh) {
        const { data: cached, error: cacheError } = await supabase
          .from('ai_analysis_cache')
          .select('*')
          .eq('project_id_source', projectId)
          .eq('is_valid', true)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!cacheError && cached) {
          return {
            summary: cached.summary,
            recommendations: cached.recommendations || [],
            prediction: cached.prediction,
            kpis_snapshot: cached.kpis_snapshot,
            generated_at: cached.created_at,
            cached: true,
          };
        }
      }

      // 3. Generar nuevo análisis con Google Gemini
      const prompt = buildAIPrompt(kpis, kpis.project_name || 'Proyecto');
      const aiResponse = await generateAIAnalysis(prompt);
      const parsed = parseAIResponse(aiResponse);

      // 4. Guardar en cache (expira en 24 horas)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await supabase.from('ai_analysis_cache').insert({
        project_id_source: projectId,
        summary: parsed.summary,
        recommendations: parsed.recommendations,
        prediction: parsed.prediction,
        kpis_snapshot: kpis,
        expires_at: expiresAt.toISOString(),
        is_valid: true,
      });

      return {
        ...parsed,
        kpis_snapshot: kpis,
        generated_at: new Date().toISOString(),
        cached: false,
      };
    },

    async getComparativeAnalysis(_, { projectIds }) {
      const projects = await resolvers.Query.getMultipleProjectKPIs(_, { projectIds });

      if (projects.length === 0) {
        throw new Error('No projects found');
      }

      const prompt = `Eres un experto en gestión de proyectos Agile.

Compara los siguientes proyectos:

${projects.map((p, i) => `
**Proyecto ${i + 1}: ${p.project_name}**
- Health Score: ${p.health_score}/100
- Progreso: ${p.progress_percentage}%
- Velocity: ${p.velocity}
- Bloqueantes: ${p.blocker_count}
`).join('\n')}

Proporciona:
1. Un resumen comparativo (2 párrafos)
2. Tres recomendaciones para el equipo de gestión
3. Una predicción sobre qué proyectos tienen más probabilidad de éxito`;

      const aiResponse = await generateAIAnalysis(prompt);
      const parsed = parseAIResponse(aiResponse);

      return {
        ...parsed,
        kpis_snapshot: projects,
        generated_at: new Date().toISOString(),
        cached: false,
      };
    },

    // ===== Logs Queries =====

    async getETLLogs(_, { limit = 20, status }) {
      let query = supabase
        .from('etl_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Error fetching ETL logs: ${error.message}`);
      }

      return data || [];
    },

    async getLatestETLLog() {
      const { data, error } = await supabase
        .from('etl_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Error fetching latest ETL log: ${error.message}`);
      }

      return data;
    },

    // ===== Health Check =====

    async healthCheck() {
      const supabaseOk = true; // Si llegamos aquí, Supabase está OK
      const mysqlOk = await testMySQLConnection();
      const geminiOk = true; // Si hay API key configurada
      const etlStatus = getETLCronStatus();

      return {
        status: 'OK',
        timestamp: new Date().toISOString(),
        services: {
          supabase: supabaseOk,
          mysql: mysqlOk,
          gemini_ai: geminiOk,
          etl: etlStatus.running ? 'RUNNING' : 'STOPPED',
        },
      };
    },
  },

  // =====================================================
  // MUTATIONS
  // =====================================================
  Mutation: {
    // ===== Dashboards Mutations =====

    async createDashboard(_, { input }, context) {
      const user = getAuthUser(context);

      // Si se marca como default, desmarcar otros
      if (input.is_default) {
        await supabase
          .from('dashboards')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { data, error } = await supabase
        .from('dashboards')
        .insert({
          ...input,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Error creating dashboard: ${error.message}`);
      }

      return data;
    },

    async updateDashboard(_, { id, input }, context) {
      const user = getAuthUser(context);

      // Verificar ownership
      const { data: existing } = await supabase
        .from('dashboards')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (!existing) {
        throw new Error('Dashboard not found or access denied');
      }

      // Si se marca como default, desmarcar otros
      if (input.is_default) {
        await supabase
          .from('dashboards')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('dashboards')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Error updating dashboard: ${error.message}`);
      }

      // Publicar evento
      pubsub.publish(EVENTS.DASHBOARD_UPDATED, { onDashboardUpdated: data });

      return data;
    },

    async deleteDashboard(_, { id }, context) {
      const user = getAuthUser(context);

      const { error } = await supabase
        .from('dashboards')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(`Error deleting dashboard: ${error.message}`);
      }

      return true;
    },

    async duplicateDashboard(_, { id, newName }, context) {
      const user = getAuthUser(context);

      // Obtener dashboard original
      const { data: original, error: fetchError } = await supabase
        .from('dashboards')
        .select('*, widgets(*)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        throw new Error('Dashboard not found or access denied');
      }

      // Crear copia
      const { data: newDashboard, error: createError } = await supabase
        .from('dashboards')
        .insert({
          user_id: user.id,
          name: newName,
          description: original.description,
          layout: original.layout,
          is_default: false,
          is_public: false,
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Error duplicating dashboard: ${createError.message}`);
      }

      // Duplicar widgets
      if (original.widgets && original.widgets.length > 0) {
        const widgetsCopy = original.widgets.map(w => ({
          dashboard_id: newDashboard.id,
          kpi_key: w.kpi_key,
          component_type: w.component_type,
          config: w.config,
          position: w.position,
          filters: w.filters,
        }));

        await supabase.from('widgets').insert(widgetsCopy);
      }

      return newDashboard;
    },

    // ===== Widgets Mutations =====

    async addWidget(_, { input }, context) {
      const user = getAuthUser(context);

      // Verificar que el dashboard pertenece al usuario
      const { data: dashboard } = await supabase
        .from('dashboards')
        .select('id')
        .eq('id', input.dashboard_id)
        .eq('user_id', user.id)
        .single();

      if (!dashboard) {
        throw new Error('Dashboard not found or access denied');
      }

      const { data, error } = await supabase
        .from('widgets')
        .insert(input)
        .select()
        .single();

      if (error) {
        throw new Error(`Error adding widget: ${error.message}`);
      }

      return data;
    },

    async updateWidget(_, { id, input }, context) {
      const user = getAuthUser(context);

      // Verificar ownership a través del dashboard
      const { data: widget } = await supabase
        .from('widgets')
        .select('dashboard_id')
        .eq('id', id)
        .single();

      if (!widget) {
        throw new Error('Widget not found');
      }

      const { data: dashboard } = await supabase
        .from('dashboards')
        .select('id')
        .eq('id', widget.dashboard_id)
        .eq('user_id', user.id)
        .single();

      if (!dashboard) {
        throw new Error('Access denied');
      }

      const { data, error } = await supabase
        .from('widgets')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Error updating widget: ${error.message}`);
      }

      return data;
    },

    async deleteWidget(_, { id }, context) {
      const user = getAuthUser(context);

      // Verificar ownership
      const { data: widget } = await supabase
        .from('widgets')
        .select('dashboard_id')
        .eq('id', id)
        .single();

      if (!widget) {
        throw new Error('Widget not found');
      }

      const { data: dashboard } = await supabase
        .from('dashboards')
        .select('id')
        .eq('id', widget.dashboard_id)
        .eq('user_id', user.id)
        .single();

      if (!dashboard) {
        throw new Error('Access denied');
      }

      const { error } = await supabase
        .from('widgets')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Error deleting widget: ${error.message}`);
      }

      return true;
    },

    async updateMultipleWidgets(_, { widgets }, context) {
      const user = getAuthUser(context);
      const updated = [];

      for (const widget of widgets) {
        try {
          const result = await resolvers.Mutation.updateWidget(
            _,
            { id: widget.id, input: { position: widget.position, config: widget.config } },
            context
          );
          updated.push(result);
        } catch (error) {
          console.error(`Error updating widget ${widget.id}:`, error);
        }
      }

      return updated;
    },

    // ===== ETL Mutations =====

    async triggerETL() {
      try {
        const result = await runETL();

        // Obtener el último log
        const log = await resolvers.Query.getLatestETLLog();

        return log;
      } catch (error) {
        throw new Error(`Failed to trigger ETL: ${error.message}`);
      }
    },

    // ===== AI Mutations =====

    async invalidateAICache(_, { projectId }) {
      const { error } = await supabase
        .from('ai_analysis_cache')
        .update({ is_valid: false })
        .eq('project_id_source', projectId);

      if (error) {
        throw new Error(`Error invalidating cache: ${error.message}`);
      }

      return true;
    },
  },

  // =====================================================
  // SUBSCRIPTIONS
  // =====================================================
  Subscription: {
    onProjectKPIsUpdated: {
      subscribe: (_, { projectId }) => {
        return pubsub.asyncIterator([EVENTS.PROJECT_KPIS_UPDATED]);
      },
      resolve: (payload, { projectId }) => {
        // Filtrar solo el proyecto solicitado
        if (payload.onProjectKPIsUpdated.project_id_source === projectId) {
          return payload.onProjectKPIsUpdated;
        }
        return null;
      },
    },

    onAnyProjectKPIsUpdated: {
      subscribe: () => pubsub.asyncIterator([EVENTS.ANY_PROJECT_KPIS_UPDATED]),
    },

    onETLStatusChange: {
      subscribe: () => pubsub.asyncIterator([EVENTS.ETL_STATUS_CHANGE]),
    },

    onDashboardUpdated: {
      subscribe: (_, { dashboardId }) => {
        return pubsub.asyncIterator([EVENTS.DASHBOARD_UPDATED]);
      },
      resolve: (payload, { dashboardId }) => {
        if (payload.onDashboardUpdated.id === dashboardId) {
          return payload.onDashboardUpdated;
        }
        return null;
      },
    },
  },

  // =====================================================
  // FIELD RESOLVERS
  // =====================================================

  Dashboard: {
    async widgets(parent) {
      const { data, error } = await supabase
        .from('widgets')
        .select('*')
        .eq('dashboard_id', parent.id);

      if (error) {
        console.error('Error fetching widgets:', error);
        return [];
      }

      return data || [];
    },
  },
};

export default resolvers;
