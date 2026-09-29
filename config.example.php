<?php
return [
  'APP_ENV' => 'production',
  // Dedicated empty MySQL 8+ database. Copy to config.php, excluded from Git.
  'DB_DSN' => 'mysql:host=127.0.0.1;port=3306;dbname=punto;charset=utf8mb4',
  'DB_USER' => 'punto',
  'DB_PASSWORD' => '',
  // Enable only when the HTTPS terminator is controlled by you and HTTP is blocked.
  'TRUST_HTTPS_PROXY' => false,
];
