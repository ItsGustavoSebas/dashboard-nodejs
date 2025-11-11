import supabase from '../config/supabaseClient.js';

/**
 * Script para insertar datos de prueba en Supabase
 * Esto simula lo que haría el ETL
 */

async function seedTestData() {
  console.log('🌱 Insertando datos de prueba en Supabase...\n');

  try {
    // 1. Insertar KPIs de proyectos de prueba
    console.log('📊 Insertando project_kpis...');

    const projectKPIs = [
      {
        project_id_source: 1,
        project_name: 'Proyecto Demo 1',
        health_score: 85,
        progress_percentage: 67.5,
        velocity: 42,
        cycle_time_avg: 3.2,
        lead_time_avg: 5.8,
        blocker_count: 2,
        workload_distribution: {
          'Juan Pérez': 12,
          'María García': 8,
          'Pedro López': 15
        }
      },
      {
        project_id_source: 2,
        project_name: 'Proyecto Demo 2',
        health_score: 72,
        progress_percentage: 45.0,
        velocity: 28,
        cycle_time_avg: 4.5,
        lead_time_avg: 7.2,
        blocker_count: 5,
        workload_distribution: {
          'Ana Martínez': 10,
          'Carlos Ruiz': 18
        }
      },
      {
        project_id_source: 3,
        project_name: 'Proyecto Demo 3',
        health_score: 92,
        progress_percentage: 88.5,
        velocity: 55,
        cycle_time_avg: 2.1,
        lead_time_avg: 3.9,
        blocker_count: 0,
        workload_distribution: {
          'Laura González': 14,
          'Miguel Ángel': 12,
          'Sofia Torres': 10
        }
      }
    ];

    const { data: projectsInserted, error: projectsError } = await supabase
      .from('project_kpis')
      .upsert(projectKPIs, { onConflict: 'project_id_source' })
      .select();

    if (projectsError) {
      console.error('❌ Error insertando project_kpis:', projectsError.message);
    } else {
      console.log(`✅ ${projectsInserted.length} proyectos insertados`);
    }

    // 2. Insertar KPIs de sprints
    console.log('\n📊 Insertando sprint_kpis...');

    const sprintKPIs = [
      {
        sprint_id_source: 1,
        project_id_source: 1,
        sprint_name: 'Sprint 1',
        velocity: 42,
        tasks_completed: 18,
        story_points_completed: 42,
        tasks_total: 25,
        completion_percentage: 72.0,
        cycle_time_avg: 3.2,
        lead_time_avg: 5.8,
        sprint_status: 'COMPLETED',
        start_date: new Date('2025-10-15').toISOString(),
        end_date: new Date('2025-10-29').toISOString()
      },
      {
        sprint_id_source: 2,
        project_id_source: 1,
        sprint_name: 'Sprint 2',
        velocity: 38,
        tasks_completed: 16,
        story_points_completed: 38,
        tasks_total: 22,
        completion_percentage: 72.7,
        cycle_time_avg: 2.9,
        lead_time_avg: 5.1,
        sprint_status: 'ACTIVE',
        start_date: new Date('2025-10-30').toISOString(),
        end_date: new Date('2025-11-13').toISOString()
      },
      {
        sprint_id_source: 3,
        project_id_source: 2,
        sprint_name: 'Sprint 1',
        velocity: 28,
        tasks_completed: 12,
        story_points_completed: 28,
        tasks_total: 20,
        completion_percentage: 60.0,
        cycle_time_avg: 4.5,
        lead_time_avg: 7.2,
        sprint_status: 'ACTIVE',
        start_date: new Date('2025-10-20').toISOString(),
        end_date: new Date('2025-11-03').toISOString()
      }
    ];

    const { data: sprintsInserted, error: sprintsError } = await supabase
      .from('sprint_kpis')
      .upsert(sprintKPIs, { onConflict: 'sprint_id_source' })
      .select();

    if (sprintsError) {
      console.error('❌ Error insertando sprint_kpis:', sprintsError.message);
    } else {
      console.log(`✅ ${sprintsInserted.length} sprints insertados`);
    }

    // 3. Insertar log del ETL
    console.log('\n📊 Insertando etl_logs...');

    const etlLog = {
      status: 'SUCCESS',
      projects_processed: 3,
      sprints_processed: 3,
      duration_ms: 1234,
      error_message: null,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString()
    };

    const { data: logInserted, error: logError } = await supabase
      .from('etl_logs')
      .insert(etlLog)
      .select();

    if (logError) {
      console.error('❌ Error insertando etl_logs:', logError.message);
    } else {
      console.log(`✅ 1 log insertado`);
    }

    // 4. Resumen
    console.log('\n✨ Datos de prueba insertados exitosamente!');
    console.log('\n📋 Resumen:');
    console.log(`   • 3 proyectos con KPIs`);
    console.log(`   • 3 sprints con KPIs`);
    console.log(`   • 1 log del ETL`);

    console.log('\n🧪 Ahora puedes probar las siguientes queries:');
    console.log('   • getProjectKPIs(projectId: 1)');
    console.log('   • getAllProjectKPIs');
    console.log('   • getSprintKPIs(sprintId: 1)');
    console.log('   • getIntelligentAnalysis(projectId: 1)');
    console.log('   • getETLLogs\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedTestData();
