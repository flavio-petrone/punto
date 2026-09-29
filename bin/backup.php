<?php
declare(strict_types=1);
namespace Punto;
if (PHP_SAPI !== 'cli') {
  exit();
}
require __DIR__ . '/../app/bootstrap.php';
$tables = [
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
$data = transaction(function () use ($tables) {
  $d = [];
  foreach ($tables as $table) {
    $d[$table] = all('SELECT * FROM ' . $table);
  }
  return $d;
});
$folder = ROOT . '/storage/backups';
if (!is_dir($folder)) {
  mkdir($folder, 0700, true);
}
$path = $folder . '/punto-' . gmdate('Ymd-His') . '-' . substr(id(), 0, 6) . '.zip';
$zip = new \ZipArchive();
$zip->open($path, \ZipArchive::CREATE);
$zip->addFromString(
  'database.json',
  json_encode(['schema' => 1, 'tables' => $data], JSON_THROW_ON_ERROR),
);
foreach ($data['deliverables'] as $f) {
  $source = ROOT . '/storage/uploads/' . $f['filename'];
  if (!is_file($source)) {
    throw new \RuntimeException('Allegato mancante. Backup interrotto.');
  }
  $zip->addFile($source, 'uploads/' . $f['filename']);
}
$zip->close();
chmod($path, 0600);
echo "Backup privato creato: $path\n";
