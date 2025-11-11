import cron from 'node-cron';
import getMySQLPool from '../config/mysqlClient.js';
import supabase from '../config/supabaseClient.js';
import { pubsub } from '../graphql/pubsub.js';

// =====================================================
// CONSTANTES Y CONFIGURACIÓN
// =====================================================

const CRON_SCHEDULE = process.env.ETL_CRON_SCHEDULE || '0 * * * *'; // Default: cada hora

// Nombres de columnas que representan estados
const IN_PROGRESS_STATES = ['En progreso', 'In Progress', 'En Progreso', 'Desarrollo'];
const DONE_STATES = ['Hecho', 'Done', 'Terminado', 'Completado'];

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

/**
 * Registrar inicio/fin de ETL en la tabla etl_logs
 */
async function createETLLog(status, data = {}) {
  const log = {
    status,
    projects_processed: data.projects_processed || 0,
    sprints_processed: data.sprints_processed || 0,
    duration_ms: data.duration_ms || null,
    error_message: data.error_message || null,
    error_stack: data.error_stack || null,
    started_at: data.started_at || new Date().toISOString(),
    finished_at: data.finished_at || null,
  };

  const { data: inserted, error } = await supabase
    .from('etl_logs')
    .insert(log)
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating ETL log:', error);
    return null;
  }

  return inserted;
}

/**
 * Actualizar log del ETL
 */
async function updateETLLog(logId, updates) {
  const { error } = await supabase
    .from('etl_logs')
    .update(updates)
    .eq('id', logId);

  if (error) {
    console.error('❌ Error updating ETL log:', error);
  }
}

/**
 * Calcular health score del proyecto
 * Fórmula: (progress_percentage * 0.6) + (on_time_percentage * 0.4)
 */
function calculateHealthScore(progress, onTimePercentage) {
  const score = Math.round((progress * 0.6) + (onTimePercentage * 0.4));
  return Math.max(0, Math.min(100, score)); // Clamp entre 0 y 100
}

/**
 * Calcular si el proyecto va a tiempo
 */
function calculateOnTimePercentage(proyecto, progressPercentage) {
  if (!proyecto.fecha_inicio || !proyecto.fecha_fin) {
    return 50; // Neutral si no hay fechas
  }

  const now = new Date();
  const start = new Date(proyecto.fecha_inicio);
  const end = new Date(proyecto.fecha_fin);

  // Si el proyecto ya terminó
  if (now > end) {
    return progressPercentage >= 100 ? 100 : 0;
  }

  // Calcular tiempo transcurrido vs tiempo total
  const totalTime = end - start;
  const elapsedTime = now - start;
  const expectedProgress = (elapsedTime / totalTime) * 100;

  // Si vamos adelantados: 100, si vamos retrasados: 0, si igual: 50
  if (progressPercentage >= expectedProgress) {
    return 100;
  } else {
    // Calcular qué tan retrasados estamos
    const delay = expectedProgress - progressPercentage;
    return Math.max(0, 100 - delay * 2);
  }
}

// =====================================================
// FUNCIONES DE EXTRACCIÓN Y CÁLCULO DE KPIs
// =====================================================

/**
 * Obtener IDs de columnas según su nombre (para identificar estados)
 */
async function getColumnIdsByName(connection, projectId, stateNames) {
  const [columns] = await connection.query(
    `SELECT id, nombre FROM columna_kanban WHERE proyecto_id = ? AND nombre IN (?)`,
    [projectId, stateNames]
  );

  return columns.map(col => col.id);
}

/**
 * Calcular KPIs de un proyecto
 */
async function calculateProjectKPIs(connection, proyecto) {
  const projectId = proyecto.id;

  // 1. Obtener todas las tareas del proyecto
  const [tareas] = await connection.query(
    `SELECT
      t.id,
      t.columna_id,
      t.puntos,
      t.prioridad,
      t.creado_en,
      c.nombre as columna_nombre
    FROM tarea t
    LEFT JOIN columna_kanban c ON t.columna_id = c.id
    WHERE t.proyecto_id = ?`,
    [projectId]
  );

  if (tareas.length === 0) {
    // Proyecto sin tareas
    return {
      project_id_source: projectId,
      project_name: proyecto.nombre,
      health_score: 50,
      progress_percentage: 0,
      velocity: 0,
      cycle_time_avg: 0,
      lead_time_avg: 0,
      blocker_count: 0,
      workload_distribution: {},
    };
  }

  // 2. Obtener IDs de columnas "Hecho"
  const doneColumnIds = await getColumnIdsByName(connection, projectId, DONE_STATES);

  // 3. Calcular progress_percentage
  const tareasCompletadas = tareas.filter(t => doneColumnIds.includes(t.columna_id));
  const progressPercentage = (tareasCompletadas.length / tareas.length) * 100;

  // 4. Calcular velocity (puntos completados en el último sprint cerrado)
  const [ultimoSprintCerrado] = await connection.query(
    `SELECT id FROM sprint
     WHERE proyecto_id = ? AND estado = 'COMPLETADO'
     ORDER BY fecha_fin DESC LIMIT 1`,
    [projectId]
  );

  let velocity = 0;
  if (ultimoSprintCerrado.length > 0) {
    const sprintId = ultimoSprintCerrado[0].id;
    const [tareasSprintCompletadas] = await connection.query(
      `SELECT SUM(puntos) as total_puntos
       FROM tarea
       WHERE sprint_id = ? AND columna_id IN (?)`,
      [sprintId, doneColumnIds.length > 0 ? doneColumnIds : [0]]
    );
    velocity = tareasSprintCompletadas[0].total_puntos || 0;
  }

  // 5. Calcular cycle_time_avg (usando historial_estado_tarea)
  const inProgressColumnIds = await getColumnIdsByName(connection, projectId, IN_PROGRESS_STATES);

  let cycleTimeAvg = 0;
  if (inProgressColumnIds.length > 0 && doneColumnIds.length > 0) {
    // Para cada tarea completada, calcular el cycle time
    const cycleTimes = [];

    for (const tarea of tareasCompletadas) {
      // Buscar cuándo entró a "En Progreso"
      const [entradaProgreso] = await connection.query(
        `SELECT MIN(cambiado_en) as fecha_inicio
         FROM historial_estado_tarea
         WHERE tarea_id = ? AND a_columna_id IN (?)`,
        [tarea.id, inProgressColumnIds]
      );

      // Buscar cuándo entró a "Hecho"
      const [entradaDone] = await connection.query(
        `SELECT MIN(cambiado_en) as fecha_fin
         FROM historial_estado_tarea
         WHERE tarea_id = ? AND a_columna_id IN (?)
         AND cambiado_en > ?`,
        [tarea.id, doneColumnIds, entradaProgreso[0]?.fecha_inicio || tarea.creado_en]
      );

      if (entradaProgreso[0]?.fecha_inicio && entradaDone[0]?.fecha_fin) {
        const inicio = new Date(entradaProgreso[0].fecha_inicio);
        const fin = new Date(entradaDone[0].fecha_fin);
        const diffDays = (fin - inicio) / (1000 * 60 * 60 * 24);
        cycleTimes.push(diffDays);
      }
    }

    if (cycleTimes.length > 0) {
      cycleTimeAvg = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
    }
  }

  // 6. Calcular lead_time_avg (desde creación hasta "Hecho")
  let leadTimeAvg = 0;
  if (doneColumnIds.length > 0) {
    const leadTimes = [];

    for (const tarea of tareasCompletadas) {
      // Buscar cuándo entró a "Hecho"
      const [entradaDone] = await connection.query(
        `SELECT MIN(cambiado_en) as fecha_fin
         FROM historial_estado_tarea
         WHERE tarea_id = ? AND a_columna_id IN (?)`,
        [tarea.id, doneColumnIds]
      );

      if (entradaDone[0]?.fecha_fin) {
        const inicio = new Date(tarea.creado_en);
        const fin = new Date(entradaDone[0].fecha_fin);
        const diffDays = (fin - inicio) / (1000 * 60 * 60 * 24);
        leadTimes.push(diffDays);
      }
    }

    if (leadTimes.length > 0) {
      leadTimeAvg = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
    }
  }

  // 7. Calcular blocker_count
  const blockerCount = tareas.filter(
    t => t.prioridad === 'BLOQUEANTE' && !doneColumnIds.includes(t.columna_id)
  ).length;

  // 8. Calcular workload_distribution
  const [tareasAsignadas] = await connection.query(
    `SELECT
      t.asignado_a,
      u.name as usuario_nombre,
      COUNT(*) as cantidad_tareas
    FROM tarea t
    LEFT JOIN usuario u ON t.asignado_a = u.id
    WHERE t.proyecto_id = ? AND t.asignado_a IS NOT NULL
    GROUP BY t.asignado_a, u.name`,
    [projectId]
  );

  const workloadDistribution = {};
  tareasAsignadas.forEach(ta => {
    workloadDistribution[ta.usuario_nombre || `Usuario ${ta.asignado_a}`] = ta.cantidad_tareas;
  });

  // 9. Calcular health_score
  const onTimePercentage = calculateOnTimePercentage(proyecto, progressPercentage);
  const healthScore = calculateHealthScore(progressPercentage, onTimePercentage);

  return {
    project_id_source: projectId,
    project_name: proyecto.nombre,
    health_score: healthScore,
    progress_percentage: parseFloat(progressPercentage.toFixed(2)),
    velocity,
    cycle_time_avg: parseFloat(cycleTimeAvg.toFixed(2)),
    lead_time_avg: parseFloat(leadTimeAvg.toFixed(2)),
    blocker_count: blockerCount,
    workload_distribution: workloadDistribution,
  };
}

/**
 * Calcular KPIs de un sprint
 */
async function calculateSprintKPIs(connection, sprint) {
  const sprintId = sprint.id;

  // Obtener tareas del sprint
  const [tareas] = await connection.query(
    `SELECT t.*, c.nombre as columna_nombre
     FROM tarea t
     LEFT JOIN columna_kanban c ON t.columna_id = c.id
     WHERE t.sprint_id = ?`,
    [sprintId]
  );

  if (tareas.length === 0) {
    return {
      sprint_id_source: sprintId,
      project_id_source: sprint.proyecto_id,
      sprint_name: sprint.nombre,
      velocity: 0,
      tasks_completed: 0,
      story_points_completed: 0,
      tasks_total: 0,
      completion_percentage: 0,
      cycle_time_avg: 0,
      lead_time_avg: 0,
      sprint_status: sprint.estado || 'PLANNED',
      start_date: sprint.fecha_inicio,
      end_date: sprint.fecha_fin,
    };
  }

  const doneColumnIds = await getColumnIdsByName(connection, sprint.proyecto_id, DONE_STATES);
  const tareasCompletadas = tareas.filter(t => doneColumnIds.includes(t.columna_id));

  const tasksCompleted = tareasCompletadas.length;
  const storyPointsCompleted = tareasCompletadas.reduce((sum, t) => sum + (t.puntos || 0), 0);
  const completionPercentage = (tasksCompleted / tareas.length) * 100;

  // Cycle time y lead time (calculado de manera similar a project KPIs)
  let cycleTimeAvg = 0;
  let leadTimeAvg = 0;

  // ... (implementación similar a calculateProjectKPIs si se necesita)

  return {
    sprint_id_source: sprintId,
    project_id_source: sprint.proyecto_id,
    sprint_name: sprint.nombre,
    velocity: storyPointsCompleted,
    tasks_completed: tasksCompleted,
    story_points_completed: storyPointsCompleted,
    tasks_total: tareas.length,
    completion_percentage: parseFloat(completionPercentage.toFixed(2)),
    cycle_time_avg: cycleTimeAvg,
    lead_time_avg: leadTimeAvg,
    sprint_status: sprint.estado || 'PLANNED',
    start_date: sprint.fecha_inicio,
    end_date: sprint.fecha_fin,
  };
}

// =====================================================
// FUNCIÓN PRINCIPAL DEL ETL
// =====================================================

/**
 * Ejecutar el proceso ETL completo
 */
export async function runETL() {
  const startTime = Date.now();
  let logId = null;

  console.log('\n🔄 ========================================');
  console.log('🔄 ETL Process Started');
  console.log('🔄 ========================================');

  try {
    // Crear log inicial
    const log = await createETLLog('RUNNING', { started_at: new Date().toISOString() });
    logId = log?.id;

    // Publicar evento de inicio
    if (pubsub) {
      pubsub.publish('ETL_STATUS_CHANGE', { onETLStatusChange: log });
    }

    // 1. Conectar a MySQL
    const pool = getMySQLPool();
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL');

    // 2. Obtener todos los proyectos
    const [proyectos] = await connection.query(
      `SELECT id, nombre, fecha_inicio, fecha_fin, estado FROM proyecto`
    );
    console.log(`📊 Found ${proyectos.length} projects to process`);

    // 3. Procesar cada proyecto
    let projectsProcessed = 0;
    let sprintsProcessed = 0;

    for (const proyecto of proyectos) {
      try {
        // Calcular KPIs del proyecto
        const projectKPIs = await calculateProjectKPIs(connection, proyecto);

        // Guardar en Supabase (upsert)
        const { data, error } = await supabase
          .from('project_kpis')
          .upsert(projectKPIs, { onConflict: 'project_id_source' })
          .select()
          .single();

        if (error) {
          console.error(`❌ Error saving KPIs for project ${proyecto.id}:`, error.message);
          continue;
        }

        console.log(`✅ KPIs saved for project: ${proyecto.nombre}`);

        // Publicar evento de actualización (para subscriptions)
        if (pubsub) {
          pubsub.publish('PROJECT_KPIS_UPDATED', {
            onProjectKPIsUpdated: data,
            onAnyProjectKPIsUpdated: data,
          });
        }

        projectsProcessed++;

        // 4. Procesar sprints del proyecto
        const [sprints] = await connection.query(
          `SELECT id, proyecto_id, nombre, fecha_inicio, fecha_fin, estado
           FROM sprint WHERE proyecto_id = ?`,
          [proyecto.id]
        );

        for (const sprint of sprints) {
          try {
            const sprintKPIs = await calculateSprintKPIs(connection, sprint);

            const { error: sprintError } = await supabase
              .from('sprint_kpis')
              .upsert(sprintKPIs, { onConflict: 'sprint_id_source' });

            if (sprintError) {
              console.error(`❌ Error saving sprint KPIs for sprint ${sprint.id}:`, sprintError.message);
              continue;
            }

            sprintsProcessed++;
          } catch (sprintError) {
            console.error(`❌ Error processing sprint ${sprint.id}:`, sprintError.message);
          }
        }
      } catch (projectError) {
        console.error(`❌ Error processing project ${proyecto.id}:`, projectError.message);
      }
    }

    // Liberar conexión
    connection.release();

    // 5. Finalizar log
    const duration = Date.now() - startTime;
    console.log(`\n✅ ETL Process Completed`);
    console.log(`📊 Projects processed: ${projectsProcessed}`);
    console.log(`📊 Sprints processed: ${sprintsProcessed}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log('🔄 ========================================\n');

    if (logId) {
      const finalLog = {
        status: 'SUCCESS',
        projects_processed: projectsProcessed,
        sprints_processed: sprintsProcessed,
        duration_ms: duration,
        finished_at: new Date().toISOString(),
      };

      await updateETLLog(logId, finalLog);

      // Publicar evento de finalización
      if (pubsub) {
        pubsub.publish('ETL_STATUS_CHANGE', {
          onETLStatusChange: { ...finalLog, id: logId },
        });
      }
    }

    return {
      success: true,
      projectsProcessed,
      sprintsProcessed,
      duration,
    };
  } catch (error) {
    console.error('❌ ETL Process Failed:', error);

    const duration = Date.now() - startTime;

    if (logId) {
      const errorLog = {
        status: 'FAILED',
        duration_ms: duration,
        error_message: error.message,
        error_stack: error.stack,
        finished_at: new Date().toISOString(),
      };

      await updateETLLog(logId, errorLog);

      // Publicar evento de error
      if (pubsub) {
        pubsub.publish('ETL_STATUS_CHANGE', {
          onETLStatusChange: { ...errorLog, id: logId },
        });
      }
    }

    throw error;
  }
}

// =====================================================
// CONFIGURACIÓN DEL CRON JOB
// =====================================================

let cronJob = null;

/**
 * Iniciar el cron job
 */
export function startETLCron() {
  if (cronJob) {
    console.log('⚠️  ETL cron job is already running');
    return;
  }

  // Validar el formato del cron schedule
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`❌ Invalid cron schedule: ${CRON_SCHEDULE}`);
    return;
  }

  cronJob = cron.schedule(CRON_SCHEDULE, async () => {
    console.log(`\n⏰ Cron job triggered at ${new Date().toISOString()}`);
    try {
      await runETL();
    } catch (error) {
      console.error('❌ Cron job failed:', error);
    }
  });

  console.log(`✅ ETL cron job started with schedule: ${CRON_SCHEDULE}`);
}

/**
 * Detener el cron job
 */
export function stopETLCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('🛑 ETL cron job stopped');
  }
}

/**
 * Obtener el estado del cron job
 */
export function getETLCronStatus() {
  return {
    running: cronJob !== null,
    schedule: CRON_SCHEDULE,
    nextExecution: cronJob?.nextDate()?.toString() || null,
  };
}

export default {
  runETL,
  startETLCron,
  stopETLCron,
  getETLCronStatus,
};
