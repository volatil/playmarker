<?php

declare(strict_types=1);

session_start();

define('APP_ROOT', dirname(__DIR__));

function load_env_file(string $filePath): void
{
    if (!file_exists($filePath) || !is_readable($filePath)) {
        return;
    }

    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);

        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        [$key, $value] = array_pad(explode('=', $trimmed, 2), 2, '');
        $key = trim($key);

        if ($key === '') {
            continue;
        }

        $value = trim($value);

        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
            (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
        putenv("$key=$value");
    }
}

load_env_file(APP_ROOT . '/.env');

date_default_timezone_set('America/Santiago');
ini_set('log_errors', 'On');
ini_set('error_log', APP_ROOT . '/logs.log');

spl_autoload_register(function (string $class): void {
    $paths = [
        APP_ROOT . "/controllers/$class.php",
    ];

    foreach ($paths as $path) {
        if (file_exists($path)) {
            require_once $path;
            return;
        }
    }
});

function app_base_path(): string
{
    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
    $basePath = str_replace('\\', '/', dirname($scriptName));

    if ($basePath === '/' || $basePath === '.') {
        return '';
    }

    return rtrim($basePath, '/');
}

function app_url(string $path = '/'): string
{
    $basePath = app_base_path();
    $normalizedPath = '/' . ltrim($path, '/');

    if ($normalizedPath === '//') {
        $normalizedPath = '/';
    }

    return ($basePath !== '' ? $basePath : '') . $normalizedPath;
}

function asset_url(string $path): string
{
    return app_url('/assets/' . ltrim($path, '/'));
}

function env_value(string $key, ?string $default = null): ?string
{
    $value = $_ENV[$key] ?? getenv($key);

    if ($value === false || $value === null || $value === '') {
        return $default;
    }

    return (string) $value;
}

function app_env(): string
{
    $configuredEnv = strtolower((string) env_value('APP_ENV', ''));

    if ($configuredEnv !== '') {
        return $configuredEnv;
    }

    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));

    if (
        $host === '' ||
        str_contains($host, 'localhost') ||
        str_contains($host, '127.0.0.1') ||
        str_contains($host, '.local')
    ) {
        return 'develop';
    }

    return 'production';
}

function google_client_id(): string
{
    $envKey = app_env() === 'production'
        ? 'GOOGLE_CLIENT_ID_PRODUCTION'
        : 'GOOGLE_CLIENT_ID_DEVELOP';

    return env_value($envKey, '') ?? '';
}

function current_user(): ?object
{
    $user = $_SESSION['user'] ?? null;

    return is_object($user) ? $user : null;
}

function is_logged_in(): bool
{
    return current_user() !== null;
}

$routes = require APP_ROOT . '/config/routes.php';

$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$basePath = app_base_path();

if ($basePath !== '' && str_starts_with($requestUri, $basePath)) {
    $requestUri = substr($requestUri, strlen($basePath)) ?: '/';
}

if ($requestUri !== '/' && substr($requestUri, -1) === '/') {
    $requestUri = rtrim($requestUri, '/');
}

$matchedHandler = null;
$routeParams = [];

foreach ($routes as $routePattern => $handler) {
    $regex = preg_replace('/\$[0-9]+/', '([^/]+)', $routePattern);
    $regex = '#^' . $regex . '$#';

    if (preg_match($regex, $requestUri, $matches)) {
        $matchedHandler = $handler;
        array_shift($matches);
        $routeParams = $matches;
        break;
    }
}

if ($matchedHandler === null) {
    require_once APP_ROOT . '/controllers/SitioController.php';
    (new SitioController())->error404();
    exit;
}

[$controller, $method] = explode('@', $matchedHandler);

require_once APP_ROOT . "/controllers/$controller.php";

call_user_func_array([new $controller(), $method], $routeParams);
