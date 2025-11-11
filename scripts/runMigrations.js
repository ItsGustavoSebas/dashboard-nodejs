import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import supabase from '../config/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  console.log('🔄 Ejecutando migraciones en Supabase...\n');

  try {
    // Leer el archivo SQL
    const migrationPath = join(__dirname, '..', 'migrations', '001_initial_schema.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Archivo de migración cargado');
    console.log(`📏 Tamaño: ${sql.length} caracteres\n`);

    // Ejecutar el SQL en Supabase
    // Nota: Supabase JS Client no soporta ejecutar SQL directamente
    // Necesitamos usar la API REST de PostgreSQL

    console.log('⚠️  IMPORTANTE:');
    console.log('   El cliente de Supabase JS no puede ejecutar scripts SQL directamente.');
    console.log('   Debes ejecutar la migración manualmente desde el Dashboard.\n');

    console.log('👉 Pasos:');
    console.log('   1. Ve a https://app.supabase.com');
    console.log('   2. Abre tu proyecto');
    console.log('   3. Ve a SQL Editor');
    console.log('   4. Copia y pega el contenido de: migrations/001_initial_schema.sql');
    console.log('   5. Haz clic en "RUN"\n');

    console.log('✅ Alternativamente, puedes usar Supabase CLI:');
    console.log('   npm install -g supabase');
    console.log('   supabase db push\n');

    // Verificar si las tablas ya existen
    console.log('🔍 Verificando si las tablas ya existen...\n');

    const tables = [
      'project_kpis',
      'sprint_kpis',
      'dashboards',
      'widgets',
      'ai_analysis_cache',
      'etl_logs'
    ];

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`❌ ${table}: NO EXISTE`);
        } else {
          console.log(`✅ ${table}: Existe (${count} registros)`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ERROR`);
      }
    }

    console.log('\n✨ Verificación completada');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigrations();
