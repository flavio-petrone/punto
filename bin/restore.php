<?php
declare(strict_types=1);
namespace Punto;
if (PHP_SAPI !== 'cli') {
  exit();
}
require __DIR__ . '/../app/bootstrap.php';
if (!in_array('--empty-database', $argv, true) || empty($argv[1]) || !is_file($argv[1])) {
  throw new \RuntimeException(
    'Uso: php bin/restore.php backup.zip --empty-database. Usa un database vuoto.',
  );
}
if (is_file(ROOT . '/storage/installed')) {
  throw new \RuntimeException('Installazione esistente: ripristino rifiutato.');
}
assert_empty_installation();
$zip = new \ZipArchive();
if ($zip->open($argv[1]) !== true) {
  throw new \RuntimeException('Archivio non valido.');
}
$manifest = json_decode($zip->getFromName('database.json') ?: '', true, 512, JSON_THROW_ON_ERROR);
$allowed = [
  'schema_migrations',
  'clients',
  'users',
  'projects',
  'project_members',
  'requests',
  'tasks',
  'comments',
  'time_entries',
  'deliverables',
  'events',
  'login_attempts',
];
if (($manifest['schema'] ?? 0) !== 1 || array_keys($manifest['tables'] ?? []) !== $allowed) {
  throw new \RuntimeException('Schema non riconosciuto.');
}
foreach ($manifest['tables']['deliverables'] as $f) {
  if (
    !preg_match('/^[a-f0-9]{24}\.(webp|pdf)$/', $f['filename']) ||
    $zip->locateName('uploads/' . $f['filename']) === false
  ) {
    throw new \RuntimeException('Allegato non valido.');
  }
}
create_schema();
transaction(function () use ($allowed, $manifest) {
  foreach ($allowed as $table) {
    foreach ($manifest['tables'][$table] as $r) {
      foreach (array_keys($r) as $key) {
        if (!preg_match('/^[a-z_]+$/', $key)) {
          throw new \RuntimeException('Campo non valido.');
        }
      }
      query(
        'INSERT INTO ' .
          table_name($table) .
          ' (' .
          implode(',', array_keys($r)) .
          ') VALUES (' .
          implode(',', array_fill(0, count($r), '?')) .
          ')',
        array_values($r),
      );
    };
  }
});
if (!is_dir(ROOT . '/storage/uploads')) {
  mkdir(ROOT . '/storage/uploads', 0700, true);
}
foreach ($manifest['tables']['deliverables'] as $f) {
  $path = ROOT . '/storage/uploads/' . $f['filename'];
  file_put_contents($path, $zip->getFromName('uploads/' . $f['filename']));
  chmod($path, 0600);
}
file_put_contents(ROOT . '/storage/installed', now());
echo "Ripristino completato. Configura APP_ENV=production prima di pubblicare.\n";
