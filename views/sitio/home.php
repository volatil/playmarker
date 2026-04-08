<div class="app-shell">
  <aside class="sidebar">
    <div class="brand-card">
      <p class="eyebrow">Pizarra tactica</p>
      <h1>PlayMarker</h1>
      <p class="subtitle">Organiza alineaciones, mueve fichas y ajusta posiciones sobre la cancha.</p>
    </div>

    <?php if (isset($user) && is_object($user)): ?>
    <section class="panel session-panel">
      <div class="session-card">
        <div class="session-user">
          <?php if (($user->picture ?? '') !== ''): ?>
          <img
            class="session-avatar"
            src="<?= htmlspecialchars((string) $user->picture, ENT_QUOTES, 'UTF-8') ?>"
            alt="<?= htmlspecialchars((string) ($user->name ?? $user->email ?? 'Usuario'), ENT_QUOTES, 'UTF-8') ?>"
          >
          <?php else: ?>
          <div class="session-avatar session-avatar-fallback" aria-hidden="true">
            <?= htmlspecialchars(strtoupper(substr((string) ($user->name ?? $user->email ?? 'U'), 0, 1)), ENT_QUOTES, 'UTF-8') ?>
          </div>
          <?php endif; ?>

          <div>
            <p class="eyebrow">Sesion activa</p>
            <p class="session-name"><?= htmlspecialchars((string) ($user->name ?? ''), ENT_QUOTES, 'UTF-8') ?></p>
            <p class="session-email"><?= htmlspecialchars((string) ($user->email ?? ''), ENT_QUOTES, 'UTF-8') ?></p>
          </div>
        </div>

        <a class="ghost-button logout-button" href="<?= htmlspecialchars(app_url('/logout'), ENT_QUOTES, 'UTF-8') ?>">Cerrar sesion</a>
      </div>
    </section>
    <?php endif; ?>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Jugadores</p>
          <h2>Plantilla en cancha</h2>
        </div>
        <button class="ghost-button" id="reset-board" type="button">Limpiar</button>
      </div>
      <ul class="player-list" id="player-list" aria-live="polite"></ul>
      <p class="empty-state" id="empty-state">Todavia no hay jugadores. Crea uno desde el formulario.</p>
    </section>

    <section class="panel">
      <div class="panel-heading form-heading">
        <div>
          <p class="eyebrow">Edicion</p>
          <h2 id="form-title">Crear jugador</h2>
        </div>
        <button class="ghost-button hidden" id="cancel-edit" type="button">Cancelar</button>
      </div>

      <form id="player-form" novalidate>
        <input id="player-id" name="playerId" type="hidden">

        <label class="field">
          <span>Nombre</span>
          <input id="player-name" name="name" type="text" maxlength="24" placeholder="Ej. Alex" required>
        </label>

        <label class="field">
          <span>Numero</span>
          <input id="player-number" name="number" type="number" min="1" max="99" inputmode="numeric" placeholder="10" required>
        </label>

        <label class="field">
          <span>Posicion</span>
          <select id="player-position" name="position" required>
            <option value="arquero">Arquero</option>
            <option value="defensa">Defensa</option>
            <option value="medio">Medio</option>
            <option value="delantero">Delantero</option>
          </select>
        </label>

        <label class="field">
          <span>Equipo</span>
          <select id="player-team" name="team">
            <option value="home">Local</option>
            <option value="away">Visita</option>
          </select>
        </label>

        <p class="form-error" id="form-error" role="alert"></p>

        <div class="form-actions">
          <button class="primary-button" id="submit-button" type="submit">Agregar jugador</button>
          <button class="danger-button hidden" id="delete-player" type="button">Eliminar jugador</button>
        </div>
      </form>
    </section>
  </aside>

  <main class="board-section">
    <div class="board-header">
      <div style="display: none;">
        <p class="eyebrow">Campo interactivo</p>
        <h2>Arrastra las fichas dentro de la cancha</h2>
      </div>
      <div class="board-header-actions">
        <p class="board-tip">Toca o haz clic sobre un jugador para editarlo desde el panel lateral.</p>
        <div class="board-actions">
          <button class="ghost-button" id="rename-board" type="button">Renombrar board</button>
          <button class="ghost-button" id="delete-board" type="button">Eliminar board</button>
          <button class="primary-button" id="add-board" type="button">Nuevo board</button>
        </div>
      </div>
    </div>

    <section class="pitch-frame">
      <div class="boards-bar">
        <div class="boards-tabs" id="boards-tabs" aria-label="Boards disponibles"></div>
      </div>

      <div class="board-layout">
        <div class="pitch" id="pitch" aria-label="Cancha de futbol interactiva">
          <div class="pitch-markings">
            <div class="half-line"></div>
            <div class="center-circle"></div>
            <div class="center-dot"></div>
            <div class="penalty-box top"></div>
            <div class="goal-box top"></div>
            <div class="penalty-spot top"></div>
            <div class="penalty-box bottom"></div>
            <div class="goal-box bottom"></div>
            <div class="penalty-spot bottom"></div>
          </div>
          <div class="players-layer" id="players-layer"></div>
        </div>

        <div class="bench" id="bench" aria-label="Zona de banca">
          <div class="bench-header">
            <p class="eyebrow">Banca</p>
            <p class="bench-tip">Arrastra jugadores aqui para dejarlos fuera de la cancha.</p>
          </div>
          <div class="bench-surface">
            <div class="bench-markings"></div>
            <div class="bench-layer" id="bench-layer"></div>
          </div>
        </div>
      </div>
    </section>
  </main>
</div>

<template id="player-item-template">
  <li class="player-item">
    <button class="player-summary" type="button"></button>
    <div class="player-item-actions">
      <button class="icon-button edit-button" type="button" aria-label="Editar jugador">Editar</button>
      <button class="icon-button delete-button" type="button" aria-label="Eliminar jugador">Eliminar</button>
    </div>
  </li>
</template>
