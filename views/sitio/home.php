<?php
$isAuthenticated = isset($user) && is_object($user);
$safeGoogleClientId = htmlspecialchars($googleClientId ?? '', ENT_QUOTES, 'UTF-8');
?>
<div
  class="app-shell"
  data-is-authenticated="<?= $isAuthenticated ? '1' : '0' ?>"
  data-initial-board-id="<?= htmlspecialchars((string) ($requestedBoardId ?? ''), ENT_QUOTES, 'UTF-8') ?>"
  data-tablas-endpoint="<?= htmlspecialchars(app_url('/api/tablas'), ENT_QUOTES, 'UTF-8') ?>"
  data-shared-tabla-template="<?= htmlspecialchars(app_url('/api/tablas/__TABLA_ID__/shared'), ENT_QUOTES, 'UTF-8') ?>"
  data-open-tabla-template="<?= htmlspecialchars(app_url('/api/tablas/__TABLA_ID__/abrir'), ENT_QUOTES, 'UTF-8') ?>"
  data-tabla-template="<?= htmlspecialchars(app_url('/api/tablas/__TABLA_ID__'), ENT_QUOTES, 'UTF-8') ?>"
>
  <aside class="sidebar">
    <div class="brand-card">
      <p class="eyebrow">Pizarra tactica</p>
      <h1>PlayMarker</h1>
      <p class="subtitle">Organiza alineaciones, mueve fichas y ajusta posiciones sobre la cancha.</p>
    </div>

    <section class="panel access-panel">
    <?php if ($isAuthenticated): ?>
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
    <?php else: ?>
      <div class="login-card login-card--sidebar">
        <p class="eyebrow">Acceso protegido</p>
        <h2>Entra a PlayMarker con Google</h2>
        <p class="subtitle">Usa tu cuenta para abrir la pizarra, organizar alineaciones y seguir trabajando sobre tus boards.</p>

        <div class="login-status" id="login-status" role="status" aria-live="polite"></div>
        <div id="google-login" class="google-login-slot"></div>

        <p class="login-help">Si el boton no aparece, revisa que el `client_id` de Google este configurado en tu archivo `.env`.</p>
      </div>
    <?php endif; ?>
    </section>

    <section class="panel player-panel">
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
        <div class="board-status-wrap">
          <!-- <p class="board-tip">Haz clic sobre un jugador para editarlo desde el panel lateral.</p> -->
          <p class="board-save-status" id="board-save-status" role="status" aria-live="polite"></p>
        </div>
        <div class="board-actions">
          <button class="primary-button" id="save-board" type="button">Guardar</button>
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

      <div class="shared-board-message hidden" id="shared-board-message" role="status" aria-live="polite"></div>

      <div class="board-layout" id="board-layout">
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

<?php if (!$isAuthenticated): ?>
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script>
  (function () {
    const clientId = "<?= $safeGoogleClientId ?>";
    const loginStatus = document.getElementById("login-status");
    const container = document.getElementById("google-login");

    const setStatus = function (message, type) {
      if (!loginStatus) {
        return;
      }

      loginStatus.textContent = message || "";
      loginStatus.className = "login-status" + (type ? " is-" + type : "");
    };

    const postGoogleToken = function (idToken) {
      setStatus("Validando acceso...", "info");

      const body = new URLSearchParams();
      body.set("losdatos", JSON.stringify({ idtoken: idToken }));

      fetch("<?= htmlspecialchars(app_url('/api/auth/google'), ENT_QUOTES, 'UTF-8') ?>", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        body: body.toString()
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (!data || !data.success) {
            setStatus((data && data.message) || "No se pudo iniciar sesion.", "error");
            return;
          }

          setStatus("Acceso autorizado. Entrando...", "success");
          window.location.href = "<?= htmlspecialchars(app_url('/'), ENT_QUOTES, 'UTF-8') ?>";
        })
        .catch(function () {
          setStatus("Ha ocurrido un error inesperado. Intentalo de nuevo.", "error");
        });
    };

    const fail = function (message) {
      setStatus(message, "error");
      if (container) {
        container.innerHTML = "";
      }
    };

    if (!clientId) {
      fail("Falta configurar el client_id de Google para este entorno.");
      return;
    }

    const initGoogleLogin = function () {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        fail("Google Identity Services no esta disponible.");
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: function (response) {
          if (!response || !response.credential) {
            fail("No se recibio la credencial de Google.");
            return;
          }

          postGoogleToken(response.credential);
        }
      });

      window.google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
        width: 320,
        locale: "es"
      });
    };

    if (window.google && window.google.accounts && window.google.accounts.id) {
      initGoogleLogin();
      return;
    }

    window.addEventListener("load", initGoogleLogin, { once: true });
  })();
</script>
<?php endif; ?>

<template id="player-item-template">
  <li class="player-item">
    <button class="player-summary" type="button"></button>
    <div class="player-item-actions">
      <button class="icon-button edit-button" type="button" aria-label="Editar jugador">Editar</button>
      <button class="icon-button delete-button" type="button" aria-label="Eliminar jugador">Eliminar</button>
    </div>
  </li>
</template>
