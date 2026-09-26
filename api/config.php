<?php
declare(strict_types=1);

function database(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    // On Hostinger, create this file one directory above public_html.
    $privateFile = dirname(__DIR__, 2) . '/thelie-config.php';
    $localFile = __DIR__ . '/config.local.php';
    $private = is_file($privateFile) ? require $privateFile : (is_file($localFile) ? require $localFile : []);
    $host = ($private['host'] ?? null) ?: (getenv('THELIE_DB_HOST') ?: 'localhost');
    $port = ($private['port'] ?? null) ?: (getenv('THELIE_DB_PORT') ?: '3306');
    $name = ($private['name'] ?? null) ?: (getenv('THELIE_DB_NAME') ?: 'u901531260_thelie');
    $user = ($private['user'] ?? null) ?: (getenv('THELIE_DB_USER') ?: 'u901531260_thelie');
    $password = ($private['password'] ?? null) ?: (getenv('THELIE_DB_PASSWORD') ?: '');

    if ($password === '') {
        throw new RuntimeException('Database credentials are not configured');
    }

    $connection = new PDO(
        "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
        $user,
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
    );

    return $connection;
}
