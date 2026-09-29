<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$public = __DIR__ . '/public';
$file = realpath($public . $path);
if ($file && str_starts_with($file, $public . '/') && is_file($file)) {
  return false;
}
if ($path === '/') {
  require $public . '/index.php';
  return;
}
http_response_code(404);
echo 'Pagina non trovata.';
