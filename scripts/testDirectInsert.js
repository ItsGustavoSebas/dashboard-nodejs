import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test directo de inserción usando SQL raw
 */

async function testDirectInsert() {
  console.log('🔍 Probando inserción directa con SQL...\n');

  try {
    // Crear cliente de Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    console.log('📡 Conectado a Supabase');
    console.log(`   URL: ${process.env.SUPABASE_URL}\n`);

    // 1. Verificar que las tablas existen
    console.log('🔍 Verificando tablas...');

    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables')
      .catch(() => null);

    // 2. Intentar insertar usando SQL raw
    console.log('\n📝 Insertando datos de prueba...\n');

    // Insertar project_kpis
    const { data: project, error: projectError } = await supabase
      .from('project_kpis')
      .insert({
        project_id_source: 999,
        project_name: 'Proyecto de Prueba',
        health_score: 85,
        progress_percentage: 67.5,
        velocity: 42,
        cycle_time_avg: 3.2,
        lead_time_avg: 5.8,
        blocker_count: 2,
        workload_distribution: { 'Test User': 10 }
      })
      .select();

    if (projectError) {
      console.error('❌ Error insertando project:', projectError);
      console.log('\n💡 Posibles causas:');
      console.log('   1. Las tablas no se crearon correctamente en Supabase');
      console.log('   2. Necesitas ejecutar la migración SQL en Supabase Dashboard');
      console.log('   3. Problemas de permisos con la API Key\n');
      console.log('🔧 Solución:');
      console.log('   1. Ve a https://app.supabase.com');
      console.log('   2. Abre SQL Editor');
      console.log('   3. Ejecuta: migrations/001_initial_schema.sql\n');
    } else {
      console.log('✅ Proyecto insertado correctamente:', project);

      // Consultar el proyecto
      const { data: fetched, error: fetchError } = await supabase
        .from('project_kpis')
        .select('*')
        .eq('project_id_source', 999)
        .single();

      if (fetchError) {
        console.error('❌ Error consultando:', fetchError);
      } else {
        console.log('✅ Proyecto consultado:', fetched);
      }
    }

    // 3. Listar todas las tablas disponibles
    console.log('\n📋 Listando tablas disponibles...');

    const tables_list = [
      'project_kpis',
      'sprint_kpis',
      'dashboards',
      'widgets',
      'ai_analysis_cache',
      'etl_logs'
    ];

    for (const table of tables_list) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ ${table}: NO EXISTE o no accesible`);
      } else {
        console.log(`   ✅ ${table}: ${count} registros`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDirectInsert();
