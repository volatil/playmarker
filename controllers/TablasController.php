<?php

declare(strict_types=1);

class TablasController extends MainController
{
    private const MAX_BOARD_NAME_LENGTH = 64;
    private const POSITION_OPTIONS = ['arquero', 'defensa', 'medio', 'delantero'];
    private const TEAM_OPTIONS = ['home', 'away'];
    private const ZONE_OPTIONS = ['pitch', 'bench'];

    public function index(): void
    {
        $user = $this->requireAuthenticatedUser();
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

        if ($method === 'GET') {
            $this->renderJson([
                'success' => true,
                'tablas' => $this->listBoards((string) $user->id),
            ]);
        }

        if ($method === 'POST') {
            $payload = $this->readJsonPayload();
            $board = $this->createBoard((string) $user->id, $payload);

            $this->renderJson([
                'success' => true,
                'tabla' => $board,
            ], 201);
        }

        $this->methodNotAllowed(['GET', 'POST']);
    }

    public function resource(string $boardId): void
    {
        $user = $this->requireAuthenticatedUser();
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

        if ($method === 'PUT') {
            $payload = $this->readJsonPayload();
            $board = $this->updateBoard((string) $user->id, $boardId, $payload);

            $this->renderJson([
                'success' => true,
                'tabla' => $board,
            ]);
        }

        if ($method === 'DELETE') {
            $this->deleteBoard((string) $user->id, $boardId);

            $this->renderJson([
                'success' => true,
            ]);
        }

        $this->methodNotAllowed(['PUT', 'DELETE']);
    }

    public function shared(string $boardId): void
    {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

        if ($method !== 'GET') {
            $this->methodNotAllowed(['GET']);
        }

        $board = $this->findSharedBoardOrFail($boardId, current_user());

        $this->renderJson([
            'success' => true,
            'tabla' => $board,
        ]);
    }

    public function open(string $boardId): void
    {
        $user = $this->requireAuthenticatedUser();
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'POST'));

        if ($method !== 'POST') {
            $this->methodNotAllowed(['POST']);
        }

        $board = $this->markBoardOpened((string) $user->id, $boardId);

        $this->renderJson([
            'success' => true,
            'tabla' => $board,
        ]);
    }

    private function requireAuthenticatedUser(): object
    {
        $user = current_user();

        if (!is_object($user) || trim((string) ($user->id ?? '')) === '') {
            $this->renderJson([
                'success' => false,
                'message' => 'Debes iniciar sesion.',
            ], 401);
        }

        return $user;
    }

    private function methodNotAllowed(array $allowedMethods): void
    {
        header('Allow: ' . implode(', ', $allowedMethods));
        $this->renderJson([
            'success' => false,
            'message' => 'Metodo no permitido.',
        ], 405);
    }

    private function readJsonPayload(): array
    {
        $rawInput = file_get_contents('php://input');

        if ($rawInput === false || trim($rawInput) === '') {
            return [];
        }

        $payload = json_decode($rawInput, true);

        if (!is_array($payload)) {
            $this->renderJson([
                'success' => false,
                'message' => 'El cuerpo JSON no es valido.',
            ], 422);
        }

        return $payload;
    }

    private function listBoards(string $userId): array
    {
        $statement = db_connection()->prepare(
            'SELECT
                id,
                usuario_id,
                nombre,
                estado_json,
                es_publica,
                codigo_compartir,
                creado_en,
                actualizado_en,
                ultima_vez_abierta_en
            FROM tablas
            WHERE usuario_id = :usuario_id
              AND eliminado_en IS NULL
            ORDER BY
                ultima_vez_abierta_en IS NULL ASC,
                ultima_vez_abierta_en DESC,
                actualizado_en DESC,
                creado_en DESC'
        );
        $statement->execute([
            'usuario_id' => $userId,
        ]);

        $boards = [];

        foreach ($statement->fetchAll() as $row) {
            if (!is_array($row)) {
                continue;
            }

            $boards[] = $this->mapBoardRow($row);
        }

        return $boards;
    }

    private function createBoard(string $userId, array $payload): array
    {
        $metadata = $this->normalizeBoardMetadataPayload($payload, true, false);
        $encodedState = $this->normalizeBoardStatePayload($payload, $metadata['nombre']);
        $boardId = app_uuid_v4();

        $statement = db_connection()->prepare(
            'INSERT INTO tablas (
                id,
                usuario_id,
                nombre,
                codigo_compartir,
                estado_json,
                es_publica,
                ultima_vez_abierta_en
            ) VALUES (
                :id,
                :usuario_id,
                :nombre,
                NULL,
                :estado_json,
                0,
                CURRENT_TIMESTAMP
            )'
        );
        $statement->execute([
            'id' => $boardId,
            'usuario_id' => $userId,
            'nombre' => $metadata['nombre'],
            'estado_json' => $encodedState,
        ]);

        return $this->findBoardOrFail($userId, $boardId);
    }

    private function updateBoard(string $userId, string $boardId, array $payload): array
    {
        $currentBoard = $this->findBoardOrFail($userId, $boardId);
        $metadata = $this->normalizeBoardMetadataPayload($payload, false, true, $currentBoard);
        $encodedState = $this->resolveUpdatedBoardStateJson($payload, $metadata['nombre'], $currentBoard);
        $statement = db_connection()->prepare(
            'UPDATE tablas
            SET nombre = :nombre,
                estado_json = :estado_json,
                es_publica = :es_publica
            WHERE id = :id
              AND usuario_id = :usuario_id
            LIMIT 1'
        );
        $statement->execute([
            'id' => $boardId,
            'usuario_id' => $userId,
            'nombre' => $metadata['nombre'],
            'estado_json' => $encodedState,
            'es_publica' => $metadata['es_publica'],
        ]);

        if ($statement->rowCount() === 0 && !$this->boardExists($userId, $boardId)) {
            $this->renderJson([
                'success' => false,
                'message' => 'La tabla no existe o no te pertenece.',
            ], 404);
        }

        return $this->findBoardOrFail($userId, $boardId);
    }

    private function deleteBoard(string $userId, string $boardId): void
    {
        $statement = db_connection()->prepare(
            'DELETE FROM tablas
            WHERE id = :id
              AND usuario_id = :usuario_id
            LIMIT 1'
        );
        $statement->execute([
            'id' => $boardId,
            'usuario_id' => $userId,
        ]);

        if ($statement->rowCount() === 0) {
            $this->renderJson([
                'success' => false,
                'message' => 'La tabla no existe o no te pertenece.',
            ], 404);
        }
    }

    private function markBoardOpened(string $userId, string $boardId): array
    {
        $statement = db_connection()->prepare(
            'UPDATE tablas
            SET ultima_vez_abierta_en = CURRENT_TIMESTAMP
            WHERE id = :id
              AND usuario_id = :usuario_id
            LIMIT 1'
        );
        $statement->execute([
            'id' => $boardId,
            'usuario_id' => $userId,
        ]);

        if ($statement->rowCount() === 0 && !$this->boardExists($userId, $boardId)) {
            $this->renderJson([
                'success' => false,
                'message' => 'La tabla no existe o no te pertenece.',
            ], 404);
        }

        return $this->findBoardOrFail($userId, $boardId);
    }

    private function boardExists(string $userId, string $boardId): bool
    {
        $statement = db_connection()->prepare(
            'SELECT 1
            FROM tablas
            WHERE id = :id
              AND usuario_id = :usuario_id
            LIMIT 1'
        );
        $statement->execute([
            'id' => $boardId,
            'usuario_id' => $userId,
        ]);

        return $statement->fetchColumn() !== false;
    }

    private function findBoardOrFail(string $userId, string $boardId): array
    {
        $statement = db_connection()->prepare(
            'SELECT
                id,
                usuario_id,
                nombre,
                estado_json,
                es_publica,
                codigo_compartir,
                creado_en,
                actualizado_en,
                ultima_vez_abierta_en
            FROM tablas
            WHERE id = :id
              AND usuario_id = :usuario_id
            LIMIT 1'
        );
        $statement->execute([
            'id' => $boardId,
            'usuario_id' => $userId,
        ]);

        $row = $statement->fetch();

        if (!is_array($row)) {
            $this->renderJson([
                'success' => false,
                'message' => 'La tabla no existe o no te pertenece.',
            ], 404);
        }

        return $this->mapBoardRow($row);
    }

    private function findSharedBoardOrFail(string $boardId, ?object $user): array
    {
        $row = $this->findBoardRowById($boardId);

        if (!is_array($row)) {
            $this->renderJson([
                'success' => false,
                'message' => 'La tabla no existe.',
            ], 404);
        }

        $ownerId = trim((string) ($row['usuario_id'] ?? ''));
        $viewerId = trim((string) ($user->id ?? ''));
        $isOwner = $ownerId !== '' && $viewerId !== '' && $ownerId === $viewerId;
        $isPublic = (int) ($row['es_publica'] ?? 0) === 1;

        if (!$isPublic && !$isOwner) {
            $this->renderJson([
                'success' => false,
                'message' => 'Este tablero es privado.',
            ], 403);
        }

        return $this->mapBoardRow($row);
    }

    private function findBoardRowById(string $boardId): ?array
    {
        $statement = db_connection()->prepare(
            'SELECT
                id,
                usuario_id,
                nombre,
                estado_json,
                es_publica,
                codigo_compartir,
                creado_en,
                actualizado_en,
                ultima_vez_abierta_en
            FROM tablas
            WHERE id = :id
            LIMIT 1'
        );
        $statement->execute([
            'id' => $boardId,
        ]);

        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    private function normalizeBoardMetadataPayload(
        array $payload,
        bool $allowEmptyNameFallback,
        bool $allowMissingFields,
        ?array $currentBoard = null
    ): array
    {
        $rawName = $payload['nombre'] ?? $payload['name'] ?? null;
        $name = $rawName !== null
            ? trim((string) $rawName)
            : ($allowMissingFields ? (string) ($currentBoard['name'] ?? '') : '');

        if ($name === '' && $allowEmptyNameFallback) {
            $name = 'Board 1';
        }

        if ($name === '') {
            $this->renderJson([
                'success' => false,
                'message' => 'El nombre de la tabla es obligatorio.',
            ], 422);
        }

        if (strlen($name) > self::MAX_BOARD_NAME_LENGTH) {
            $this->renderJson([
                'success' => false,
                'message' => 'El nombre de la tabla no puede superar 64 caracteres.',
            ], 422);
        }

        $visibility = $this->normalizeVisibilityValue(
            $payload['es_publica'] ?? $payload['isPublic'] ?? null,
            $allowMissingFields ? (bool) ($currentBoard['isPublic'] ?? false) : false,
            $allowMissingFields
        );

        return [
            'nombre' => $name,
            'es_publica' => $visibility ? 1 : 0,
        ];
    }

    private function normalizeBoardStatePayload(array $payload, string $boardName): string
    {
        $stateInput = $payload['estado'] ?? $payload['state'] ?? null;

        if (!is_array($stateInput)) {
            $this->renderJson([
                'success' => false,
                'message' => 'Debes enviar un estado JSON valido.',
            ], 422);
        }

        $normalizedState = $this->normalizeBoardState($boardName, $stateInput);
        return $this->encodeBoardState($normalizedState);
    }

    private function resolveUpdatedBoardStateJson(array $payload, string $boardName, array $currentBoard): string
    {
        $stateInput = $payload['estado'] ?? $payload['state'] ?? null;

        if ($stateInput === null) {
            $currentState = $currentBoard['state'] ?? null;

            if (!is_array($currentState)) {
                $this->renderJson([
                    'success' => false,
                    'message' => 'No se pudo recuperar el estado actual de la tabla.',
                ], 500);
            }

            $currentState['name'] = $boardName;

            return $this->encodeBoardState($this->normalizeBoardState($boardName, $currentState));
        }

        return $this->normalizeBoardStatePayload($payload, $boardName);
    }

    private function encodeBoardState(array $normalizedState): string
    {
        $encodedState = json_encode($normalizedState, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if (!is_string($encodedState) || $encodedState === '') {
            $this->renderJson([
                'success' => false,
                'message' => 'No se pudo serializar el estado de la tabla.',
            ], 500);
        }

        return $encodedState;
    }

    private function normalizeVisibilityValue(mixed $rawValue, bool $fallback, bool $allowMissing): bool
    {
        if ($rawValue === null) {
            return $allowMissing ? $fallback : false;
        }

        if (is_bool($rawValue)) {
            return $rawValue;
        }

        if (is_int($rawValue) || is_float($rawValue)) {
            return (int) $rawValue === 1;
        }

        if (is_string($rawValue)) {
            $normalized = strtolower(trim($rawValue));

            if ($normalized === '1' || $normalized === 'true') {
                return true;
            }

            if ($normalized === '0' || $normalized === 'false') {
                return false;
            }
        }

        $this->renderJson([
            'success' => false,
            'message' => 'El valor de visibilidad no es valido.',
        ], 422);
    }

    private function normalizeBoardState(string $boardName, array $state): array
    {
        $playersInput = $state['players'] ?? null;

        if (!is_array($playersInput)) {
            $this->renderJson([
                'success' => false,
                'message' => 'El estado debe incluir una lista de jugadores.',
            ], 422);
        }

        $players = [];

        foreach ($playersInput as $player) {
            if (!is_array($player)) {
                $this->renderJson([
                    'success' => false,
                    'message' => 'Cada jugador debe ser un objeto JSON valido.',
                ], 422);
            }

            $players[] = $this->normalizePlayerState($player);
        }

        $version = (int) ($state['version'] ?? 1);
        if ($version < 1) {
            $version = 1;
        }

        return [
            'version' => $version,
            'name' => $boardName,
            'players' => $players,
        ];
    }

    private function normalizePlayerState(array $player): array
    {
        $id = trim((string) ($player['id'] ?? ''));
        $name = trim((string) ($player['name'] ?? ''));
        $number = trim((string) ($player['number'] ?? ''));
        $position = strtolower(trim((string) ($player['position'] ?? '')));
        $team = strtolower(trim((string) ($player['team'] ?? '')));
        $zone = strtolower(trim((string) ($player['zone'] ?? 'pitch')));
        $x = filter_var($player['x'] ?? null, FILTER_VALIDATE_FLOAT);
        $y = filter_var($player['y'] ?? null, FILTER_VALIDATE_FLOAT);

        if ($id === '' || $name === '' || $number === '') {
            $this->renderJson([
                'success' => false,
                'message' => 'Cada jugador debe incluir id, nombre y numero.',
            ], 422);
        }

        $shirtNumber = filter_var($number, FILTER_VALIDATE_INT);
        if ($shirtNumber === false || $shirtNumber < 1 || $shirtNumber > 99) {
            $this->renderJson([
                'success' => false,
                'message' => 'El numero del jugador debe estar entre 1 y 99.',
            ], 422);
        }

        if (!in_array($position, self::POSITION_OPTIONS, true)) {
            $this->renderJson([
                'success' => false,
                'message' => 'La posicion del jugador no es valida.',
            ], 422);
        }

        if (!in_array($team, self::TEAM_OPTIONS, true)) {
            $this->renderJson([
                'success' => false,
                'message' => 'El equipo del jugador no es valido.',
            ], 422);
        }

        if (!in_array($zone, self::ZONE_OPTIONS, true)) {
            $this->renderJson([
                'success' => false,
                'message' => 'La zona del jugador no es valida.',
            ], 422);
        }

        if ($x === false || $y === false) {
            $this->renderJson([
                'success' => false,
                'message' => 'Las coordenadas del jugador deben ser numericas.',
            ], 422);
        }

        return [
            'id' => $id,
            'name' => substr($name, 0, 24),
            'number' => (string) $shirtNumber,
            'position' => $position,
            'team' => $team,
            'zone' => $zone,
            'x' => round((float) $x, 2),
            'y' => round((float) $y, 2),
        ];
    }

    private function mapBoardRow(array $row): array
    {
        $decodedState = json_decode((string) ($row['estado_json'] ?? ''), true);
        $normalizedState = is_array($decodedState)
            ? $this->normalizePersistedBoardState((string) ($row['nombre'] ?? 'Board'), $decodedState)
            : [
                'version' => 1,
                'name' => (string) ($row['nombre'] ?? 'Board'),
                'players' => [],
            ];

        return [
            'id' => (string) $row['id'],
            'name' => (string) $row['nombre'],
            'players' => $normalizedState['players'],
            'state' => $normalizedState,
            'isPublic' => (bool) ((int) ($row['es_publica'] ?? 0)),
            'shareCode' => $row['codigo_compartir'] !== null ? (string) $row['codigo_compartir'] : null,
            'createdAt' => $row['creado_en'] !== null ? (string) $row['creado_en'] : null,
            'updatedAt' => $row['actualizado_en'] !== null ? (string) $row['actualizado_en'] : null,
            'lastOpenedAt' => $row['ultima_vez_abierta_en'] !== null ? (string) $row['ultima_vez_abierta_en'] : null,
        ];
    }

    private function normalizePersistedBoardState(string $boardName, array $state): array
    {
        $playersInput = $state['players'] ?? [];
        $players = [];

        if (is_array($playersInput)) {
            foreach ($playersInput as $player) {
                if (!is_array($player)) {
                    continue;
                }

                $normalizedPlayer = $this->sanitizePersistedPlayer($player);
                if ($normalizedPlayer !== null) {
                    $players[] = $normalizedPlayer;
                }
            }
        }

        $version = (int) ($state['version'] ?? 1);
        if ($version < 1) {
            $version = 1;
        }

        return [
            'version' => $version,
            'name' => $boardName,
            'players' => $players,
        ];
    }

    private function sanitizePersistedPlayer(array $player): ?array
    {
        $id = trim((string) ($player['id'] ?? ''));
        $name = trim((string) ($player['name'] ?? ''));
        $number = trim((string) ($player['number'] ?? ''));
        $position = strtolower(trim((string) ($player['position'] ?? '')));
        $team = strtolower(trim((string) ($player['team'] ?? '')));
        $zone = strtolower(trim((string) ($player['zone'] ?? 'pitch')));
        $x = filter_var($player['x'] ?? null, FILTER_VALIDATE_FLOAT);
        $y = filter_var($player['y'] ?? null, FILTER_VALIDATE_FLOAT);
        $shirtNumber = filter_var($number, FILTER_VALIDATE_INT);

        if (
            $id === '' ||
            $name === '' ||
            $shirtNumber === false ||
            $shirtNumber < 1 ||
            $shirtNumber > 99 ||
            !in_array($position, self::POSITION_OPTIONS, true) ||
            !in_array($team, self::TEAM_OPTIONS, true) ||
            !in_array($zone, self::ZONE_OPTIONS, true) ||
            $x === false ||
            $y === false
        ) {
            return null;
        }

        return [
            'id' => $id,
            'name' => substr($name, 0, 24),
            'number' => (string) $shirtNumber,
            'position' => $position,
            'team' => $team,
            'zone' => $zone,
            'x' => round((float) $x, 2),
            'y' => round((float) $y, 2),
        ];
    }
}
