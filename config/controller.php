<?php

declare(strict_types=1);

session_start();

define('APP_ROOT', dirname(__DIR__));

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
