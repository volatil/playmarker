<?php

declare(strict_types=1);

$documentRoot = __DIR__;
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$decodedPath = rawurldecode($requestPath);
$relativePath = ltrim(str_replace('\\', '/', $decodedPath), '/');
$fullPath = realpath($documentRoot . '/' . $relativePath);
$assetsRoot = realpath($documentRoot . '/assets');

$isPublicAsset = $fullPath !== false
    && $assetsRoot !== false
    && ($fullPath === $assetsRoot || str_starts_with($fullPath, $assetsRoot . DIRECTORY_SEPARATOR))
    && is_file($fullPath);

if ($isPublicAsset) {
    return false;
}

$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';

require $documentRoot . '/index.php';
