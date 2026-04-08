<?php $safeGoogleClientId = htmlspecialchars($googleClientId ?? '', ENT_QUOTES, 'UTF-8'); ?>
<section class="login-shell">
  <div class="login-card">
    <p class="eyebrow">Acceso protegido</p>
    <h1>Entra a PlayMarker con Google</h1>
    <p class="subtitle">Usa tu cuenta para abrir la pizarra, organizar alineaciones y seguir trabajando sobre tus boards.</p>

    <div class="login-status" id="login-status" role="status" aria-live="polite"></div>
    <div id="google-login" class="google-login-slot"></div>

    <p class="login-help">Si el boton no aparece, revisa que el `client_id` de Google este configurado en tu archivo `.env`.</p>
  </div>
</section>

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
