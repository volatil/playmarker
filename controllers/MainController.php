<?php

declare(strict_types=1);

class MainController
{
    protected function render(string $view, array $params = [], string $layout = 'main'): void
    {
        $viewPath = APP_ROOT . '/views/' . ltrim($view, '/');
        $layoutPath = APP_ROOT . '/templates/layout/' . $layout . '/index.php';

        if (!file_exists($viewPath)) {
            http_response_code(500);
            echo 'Vista no encontrada.';
            exit;
        }

        extract($params, EXTR_SKIP);

        if (file_exists($layoutPath)) {
            include $layoutPath;
            exit;
        }

        include $viewPath;
        exit;
    }

    protected function renderJson(array $data, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    protected function metaDefaults(): array
    {
        return [
            'title' => 'PlayMarker',
            'description' => 'Organiza alineaciones, mueve fichas y ajusta posiciones sobre la cancha con PlayMarker.',
            'ogTitle' => 'PlayMarker',
            'ogDescription' => 'Organiza alineaciones, mueve fichas y ajusta posiciones sobre la cancha.',
            'ogImage' => asset_url('images/og-image.png'),
            'faviconIco' => asset_url('images/favicon.ico'),
            'stylesheets' => [
                asset_url('css/styles.css'),
            ],
            'scripts' => [
                asset_url('js/app.js'),
            ],
        ];
    }

    protected function verifyGoogleIdToken(string $token): ?object
    {
        $clientId = google_client_id();

        if ($clientId === '' || !function_exists('openssl_verify') || !defined('OPENSSL_ALGO_SHA256')) {
            return null;
        }

        $parts = explode('.', $token);

        if (count($parts) !== 3) {
            return null;
        }

        $header = $this->decodeJwtPart($parts[0]);
        $payload = $this->decodeJwtPart($parts[1]);
        $signature = $this->base64UrlDecode($parts[2]);

        if (!is_array($header) || !is_array($payload) || $signature === null) {
            return null;
        }

        if (($header['alg'] ?? '') !== 'RS256') {
            return null;
        }

        $kid = trim((string) ($header['kid'] ?? ''));

        if ($kid === '') {
            return null;
        }

        $publicKeyPem = $this->findGooglePublicKeyPem($kid);

        if ($publicKeyPem === null) {
            return null;
        }

        $verified = openssl_verify($parts[0] . '.' . $parts[1], $signature, $publicKeyPem, OPENSSL_ALGO_SHA256);

        if ($verified !== 1 || !$this->validateGoogleTokenClaims($payload, $clientId)) {
            return null;
        }

        return (object) $payload;
    }

    private function validateGoogleTokenClaims(array $payload, string $clientId): bool
    {
        $now = time();
        $clockSkewSeconds = 300;
        $issuer = (string) ($payload['iss'] ?? '');
        $audience = $payload['aud'] ?? null;

        if (!in_array($issuer, ['accounts.google.com', 'https://accounts.google.com'], true)) {
            return false;
        }

        if (is_array($audience)) {
            if (!in_array($clientId, $audience, true)) {
                return false;
            }
        } elseif ((string) $audience !== $clientId) {
            return false;
        }

        $expiresAt = filter_var($payload['exp'] ?? null, FILTER_VALIDATE_INT);
        if ($expiresAt === false || $expiresAt < ($now - $clockSkewSeconds)) {
            return false;
        }

        $issuedAt = filter_var($payload['iat'] ?? null, FILTER_VALIDATE_INT);
        if ($issuedAt !== false && $issuedAt > ($now + $clockSkewSeconds)) {
            return false;
        }

        $notBefore = filter_var($payload['nbf'] ?? null, FILTER_VALIDATE_INT);
        if ($notBefore !== false && $notBefore > ($now + $clockSkewSeconds)) {
            return false;
        }

        return trim((string) ($payload['sub'] ?? '')) !== '' &&
            trim((string) ($payload['email'] ?? '')) !== '';
    }

    private function findGooglePublicKeyPem(string $kid): ?string
    {
        $keys = $this->googlePublicKeys();

        foreach ($keys as $key) {
            if (!is_array($key) || (string) ($key['kid'] ?? '') !== $kid) {
                continue;
            }

            if (($key['kty'] ?? '') !== 'RSA' || ($key['use'] ?? 'sig') !== 'sig') {
                return null;
            }

            return $this->jwkToPem($key);
        }

        return null;
    }

    private function googlePublicKeys(): array
    {
        $cachePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'playmarker_google_jwks.json';
        $cached = $this->readGooglePublicKeysCache($cachePath);

        if (is_array($cached)) {
            return $cached;
        }

        $response = $this->fetchUrl('https://www.googleapis.com/oauth2/v3/certs');

        if ($response === null) {
            return [];
        }

        $data = json_decode($response['body'], true);
        $keys = is_array($data) && is_array($data['keys'] ?? null) ? $data['keys'] : [];

        if ($keys === []) {
            return [];
        }

        $maxAge = $this->cacheMaxAgeSeconds($response['headers']);
        $cachePayload = [
            'expiresAt' => time() + $maxAge,
            'keys' => $keys,
        ];

        @file_put_contents($cachePath, json_encode($cachePayload, JSON_UNESCAPED_SLASHES));

        return $keys;
    }

    private function readGooglePublicKeysCache(string $cachePath): ?array
    {
        if (!is_readable($cachePath)) {
            return null;
        }

        $contents = file_get_contents($cachePath);
        $cache = is_string($contents) ? json_decode($contents, true) : null;

        if (
            !is_array($cache) ||
            !is_array($cache['keys'] ?? null) ||
            (int) ($cache['expiresAt'] ?? 0) <= time()
        ) {
            return null;
        }

        return $cache['keys'];
    }

    private function fetchUrl(string $url): ?array
    {
        $headers = [];
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 5,
                'ignore_errors' => true,
            ],
        ]);
        $body = @file_get_contents($url, false, $context);

        if (isset($http_response_header) && is_array($http_response_header)) {
            $headers = $http_response_header;
        }

        if (is_string($body) && $body !== '') {
            return [
                'body' => $body,
                'headers' => $headers,
            ];
        }

        if (!function_exists('curl_init')) {
            return $this->fetchUrlWithTlsSocket($url);
        }

        $curl = curl_init($url);
        if ($curl === false) {
            return null;
        }

        $responseHeaders = [];
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_HEADERFUNCTION => static function ($curl, string $header) use (&$responseHeaders): int {
                $responseHeaders[] = trim($header);
                return strlen($header);
            },
        ]);

        $curlBody = curl_exec($curl);
        curl_close($curl);

        if (!is_string($curlBody) || $curlBody === '') {
            return null;
        }

        return [
            'body' => $curlBody,
            'headers' => $responseHeaders,
        ];
    }

    private function fetchUrlWithTlsSocket(string $url): ?array
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');
        $path = (string) ($parts['path'] ?? '/');
        $query = (string) ($parts['query'] ?? '');

        if ($scheme !== 'https' || $host === '') {
            return null;
        }

        $target = 'ssl://' . $host . ':443';
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
                'SNI_enabled' => true,
                'peer_name' => $host,
            ],
        ]);
        $socket = @stream_socket_client($target, $errno, $errstr, 5, STREAM_CLIENT_CONNECT, $context);

        if (!is_resource($socket)) {
            return null;
        }

        stream_set_timeout($socket, 5);

        $requestPath = $path . ($query !== '' ? '?' . $query : '');
        $request = "GET $requestPath HTTP/1.1\r\n" .
            "Host: $host\r\n" .
            "User-Agent: PlayMarker/1.0\r\n" .
            "Accept: application/json\r\n" .
            "Connection: close\r\n\r\n";

        fwrite($socket, $request);
        $response = stream_get_contents($socket);
        fclose($socket);

        if (!is_string($response) || $response === '') {
            return null;
        }

        [$rawHeaders, $body] = array_pad(explode("\r\n\r\n", $response, 2), 2, '');
        $headers = explode("\r\n", $rawHeaders);
        $statusLine = (string) ($headers[0] ?? '');

        if (!str_contains($statusLine, ' 200 ')) {
            return null;
        }

        if ($this->headersContainChunkedEncoding($headers)) {
            $body = $this->decodeChunkedBody($body);
        }

        return $body !== ''
            ? [
                'body' => $body,
                'headers' => $headers,
            ]
            : null;
    }

    private function headersContainChunkedEncoding(array $headers): bool
    {
        foreach ($headers as $header) {
            if (stripos((string) $header, 'transfer-encoding:') === 0 && stripos((string) $header, 'chunked') !== false) {
                return true;
            }
        }

        return false;
    }

    private function decodeChunkedBody(string $body): string
    {
        $decoded = '';
        $offset = 0;
        $length = strlen($body);

        while ($offset < $length) {
            $lineEnd = strpos($body, "\r\n", $offset);

            if ($lineEnd === false) {
                return '';
            }

            $chunkSizeHex = explode(';', trim(substr($body, $offset, $lineEnd - $offset)), 2)[0];
            $chunkSize = hexdec($chunkSizeHex);
            $offset = $lineEnd + 2;

            if ($chunkSize === 0) {
                break;
            }

            $decoded .= substr($body, $offset, $chunkSize);
            $offset += $chunkSize + 2;
        }

        return $decoded;
    }

    private function cacheMaxAgeSeconds(array $headers): int
    {
        foreach ($headers as $header) {
            if (!is_string($header) || stripos($header, 'cache-control:') !== 0) {
                continue;
            }

            if (preg_match('/max-age=(\d+)/i', $header, $matches) === 1) {
                return max(60, (int) $matches[1]);
            }
        }

        return 3600;
    }

    private function decodeJwtPart(string $part): ?array
    {
        $decoded = $this->base64UrlDecode($part);

        if ($decoded === null) {
            return null;
        }

        $data = json_decode($decoded, true);

        return is_array($data) ? $data : null;
    }

    private function base64UrlDecode(string $value): ?string
    {
        $base64 = strtr($value, '-_', '+/');
        $padding = strlen($base64) % 4;

        if ($padding > 0) {
            $base64 .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode($base64, true);

        return is_string($decoded) ? $decoded : null;
    }

    private function jwkToPem(array $jwk): ?string
    {
        $modulus = $this->base64UrlDecode((string) ($jwk['n'] ?? ''));
        $exponent = $this->base64UrlDecode((string) ($jwk['e'] ?? ''));

        if ($modulus === null || $exponent === null) {
            return null;
        }

        $rsaPublicKey = $this->derSequence(
            $this->derInteger($modulus) .
            $this->derInteger($exponent)
        );
        $algorithmIdentifier = hex2bin('300d06092a864886f70d0101010500');

        if ($algorithmIdentifier === false) {
            return null;
        }

        $subjectPublicKeyInfo = $this->derSequence(
            $algorithmIdentifier .
            $this->derBitString($rsaPublicKey)
        );

        return "-----BEGIN PUBLIC KEY-----\n" .
            chunk_split(base64_encode($subjectPublicKeyInfo), 64, "\n") .
            "-----END PUBLIC KEY-----\n";
    }

    private function derSequence(string $value): string
    {
        return "\x30" . $this->derLength(strlen($value)) . $value;
    }

    private function derInteger(string $value): string
    {
        $value = ltrim($value, "\x00");

        if ($value === '') {
            $value = "\x00";
        }

        if ((ord($value[0]) & 0x80) !== 0) {
            $value = "\x00" . $value;
        }

        return "\x02" . $this->derLength(strlen($value)) . $value;
    }

    private function derBitString(string $value): string
    {
        return "\x03" . $this->derLength(strlen($value) + 1) . "\x00" . $value;
    }

    private function derLength(int $length): string
    {
        if ($length < 128) {
            return chr($length);
        }

        $bytes = '';

        while ($length > 0) {
            $bytes = chr($length & 0xff) . $bytes;
            $length >>= 8;
        }

        return chr(0x80 | strlen($bytes)) . $bytes;
    }
}
