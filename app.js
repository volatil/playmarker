const STORAGE_KEY = "playmarker-board-state";
const DEFAULT_POSITION = {
  home: { x: 50, y: 72 },
  away: { x: 50, y: 28 },
};

const state = {
  players: loadPlayers(),
  selectedPlayerId: null,
  draggingPlayerId: null,
  dragPointerId: null,
};

const elements = {
  playerForm: document.querySelector("#player-form"),
  playerId: document.querySelector("#player-id"),
  playerName: document.querySelector("#player-name"),
  playerNumber: document.querySelector("#player-number"),
  playerPosition: document.querySelector("#player-position"),
  playerTeam: document.querySelector("#player-team"),
  playerList: document.querySelector("#player-list"),
  emptyState: document.querySelector("#empty-state"),
  playersLayer: document.querySelector("#players-layer"),
  pitch: document.querySelector("#pitch"),
  formTitle: document.querySelector("#form-title"),
  submitButton: document.querySelector("#submit-button"),
  deleteButton: document.querySelector("#delete-player"),
  cancelEditButton: document.querySelector("#cancel-edit"),
  resetBoardButton: document.querySelector("#reset-board"),
  formError: document.querySelector("#form-error"),
  playerItemTemplate: document.querySelector("#player-item-template"),
};

render();

elements.playerForm.addEventListener("submit", handleFormSubmit);
elements.deleteButton.addEventListener("click", handleDeleteSelected);
elements.cancelEditButton.addEventListener("click", resetForm);
elements.resetBoardButton.addEventListener("click", handleResetBoard);
window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", stopDragging);
window.addEventListener("pointercancel", stopDragging);
window.addEventListener("resize", renderPlayers);

function loadPlayers() {
  try {
    const rawState = localStorage.getItem(STORAGE_KEY);
    if (!rawState) {
      return [];
    }

    const parsed = JSON.parse(rawState);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isValidStoredPlayer)
      .map((player) => ({
        ...player,
        x: clamp(player.x, 6, 94),
        y: clamp(player.y, 6, 94),
      }));
  } catch (error) {
    return [];
  }
}

function isValidStoredPlayer(player) {
  return (
    player &&
    typeof player.id === "string" &&
    typeof player.name === "string" &&
    typeof player.number === "string" &&
    typeof player.position === "string" &&
    (player.team === "home" || player.team === "away") &&
    Number.isFinite(player.x) &&
    Number.isFinite(player.y)
  );
}

function savePlayers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.players));
}

function handleFormSubmit(event) {
  event.preventDefault();
  clearError();

  const formData = new FormData(elements.playerForm);
  const payload = {
    id: String(formData.get("playerId") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    number: String(formData.get("number") || "").trim(),
    position: String(formData.get("position") || "").trim(),
    team: String(formData.get("team") || "home"),
  };

  const validationError = validatePlayer(payload);
  if (validationError) {
    showError(validationError);
    return;
  }

  if (payload.id) {
    state.players = state.players.map((player) =>
      player.id === payload.id
        ? {
            ...player,
            name: payload.name,
            number: payload.number,
            position: payload.position,
            team: payload.team,
          }
        : player
    );
    state.selectedPlayerId = payload.id;
  } else {
    const { x, y } = getNextSpawnPosition(payload.team);
    const newPlayer = {
      id: createPlayerId(),
      name: payload.name,
      number: payload.number,
      position: payload.position,
      team: payload.team,
      x,
      y,
    };
    state.players = [...state.players, newPlayer];
    state.selectedPlayerId = newPlayer.id;
  }

  savePlayers();
  render();
}

function validatePlayer(player) {
  if (!player.name) {
    return "El nombre es obligatorio.";
  }

  const shirtNumber = Number(player.number);
  if (!player.number || Number.isNaN(shirtNumber) || shirtNumber < 1 || shirtNumber > 99) {
    return "El numero debe estar entre 1 y 99.";
  }

  if (!player.position) {
    return "La posicion es obligatoria.";
  }

  if (player.team !== "home" && player.team !== "away") {
    return "Selecciona un equipo valido.";
  }

  return "";
}

function getNextSpawnPosition(team) {
  const teamPlayers = state.players.filter((player) => player.team === team);
  const base = DEFAULT_POSITION[team];
  const row = Math.floor(teamPlayers.length / 4);
  const column = teamPlayers.length % 4;
  const x = clamp(base.x - 24 + column * 16, 10, 90);
  const direction = team === "home" ? -1 : 1;
  const y = clamp(base.y + row * direction * 10, 10, 90);
  return { x, y };
}

function handleDeleteSelected() {
  if (!state.selectedPlayerId) {
    return;
  }

  state.players = state.players.filter((player) => player.id !== state.selectedPlayerId);
  state.selectedPlayerId = null;
  savePlayers();
  render();
}

function handleDeletePlayer(playerId) {
  state.players = state.players.filter((player) => player.id !== playerId);
  if (state.selectedPlayerId === playerId) {
    state.selectedPlayerId = null;
  }
  savePlayers();
  render();
}

function handleResetBoard() {
  state.players = [];
  state.selectedPlayerId = null;
  state.draggingPlayerId = null;
  state.dragPointerId = null;
  localStorage.removeItem(STORAGE_KEY);
  render();
}

function selectPlayer(playerId) {
  state.selectedPlayerId = playerId;
  clearError();
  render();
}

function resetForm() {
  state.selectedPlayerId = null;
  clearError();
  elements.playerForm.reset();
  elements.playerTeam.value = "home";
  syncForm();
  renderPlayers();
  renderPlayerList();
}

function syncForm() {
  const selectedPlayer = state.players.find((player) => player.id === state.selectedPlayerId);

  if (!selectedPlayer) {
    elements.formTitle.textContent = "Crear jugador";
    elements.submitButton.textContent = "Agregar jugador";
    elements.deleteButton.classList.add("hidden");
    elements.cancelEditButton.classList.add("hidden");
    elements.playerId.value = "";
    if (!document.activeElement || document.activeElement === document.body) {
      elements.playerForm.reset();
      elements.playerTeam.value = "home";
    }
    return;
  }

  elements.formTitle.textContent = "Editar jugador";
  elements.submitButton.textContent = "Guardar cambios";
  elements.deleteButton.classList.remove("hidden");
  elements.cancelEditButton.classList.remove("hidden");
  elements.playerId.value = selectedPlayer.id;
  elements.playerName.value = selectedPlayer.name;
  elements.playerNumber.value = selectedPlayer.number;
  elements.playerPosition.value = selectedPlayer.position;
  elements.playerTeam.value = selectedPlayer.team;
}

function render() {
  syncForm();
  renderPlayerList();
  renderPlayers();
}

function renderPlayerList() {
  elements.playerList.innerHTML = "";
  elements.emptyState.classList.toggle("hidden", state.players.length > 0);

  const fragment = document.createDocumentFragment();

  state.players.forEach((player) => {
    const item = elements.playerItemTemplate.content.firstElementChild.cloneNode(true);
    const summaryButton = item.querySelector(".player-summary");
    const editButton = item.querySelector(".edit-button");
    const deleteButton = item.querySelector(".delete-button");
    const selected = player.id === state.selectedPlayerId;
    const teamLabel = player.team === "home" ? "Local" : "Visita";

    summaryButton.classList.toggle("is-active", selected);
    summaryButton.innerHTML = `
      <div class="summary-top">
        <span class="summary-name">${escapeHtml(player.name)}</span>
        <span class="summary-number">#${escapeHtml(player.number)}</span>
      </div>
      <div class="summary-bottom">
        <span>${escapeHtml(player.position)}</span>
        <span class="summary-team team-${player.team}">${teamLabel}</span>
      </div>
    `;

    summaryButton.addEventListener("click", () => selectPlayer(player.id));
    editButton.addEventListener("click", () => selectPlayer(player.id));
    deleteButton.addEventListener("click", () => handleDeletePlayer(player.id));

    fragment.appendChild(item);
  });

  elements.playerList.appendChild(fragment);
}

function renderPlayers() {
  elements.playersLayer.innerHTML = "";
  const fragment = document.createDocumentFragment();

  state.players.forEach((player) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "player-marker";
    marker.dataset.playerId = player.id;
    marker.dataset.team = player.team;
    marker.style.left = `${player.x}%`;
    marker.style.top = `${player.y}%`;
    marker.classList.toggle("is-selected", player.id === state.selectedPlayerId);
    marker.innerHTML = `
      <span class="player-chip">
        <span class="player-token">${escapeHtml(player.number)}</span>
        <span class="player-name">${escapeHtml(player.name)}</span>
      </span>
    `;

    marker.addEventListener("click", () => {
      if (state.draggingPlayerId !== player.id) {
        selectPlayer(player.id);
      }
    });

    marker.addEventListener("pointerdown", (event) => startDragging(event, player.id));
    fragment.appendChild(marker);
  });

  elements.playersLayer.appendChild(fragment);
}

function startDragging(event, playerId) {
  event.preventDefault();
  state.draggingPlayerId = playerId;
  state.dragPointerId = event.pointerId;
  state.selectedPlayerId = playerId;
  clearError();
  syncForm();
  renderPlayerList();
  updatePlayerPosition(playerId, event);
}

function handlePointerMove(event) {
  if (!state.draggingPlayerId || event.pointerId !== state.dragPointerId) {
    return;
  }

  updatePlayerPosition(state.draggingPlayerId, event);
}

function stopDragging(event) {
  if (event.pointerId !== state.dragPointerId) {
    return;
  }

  state.draggingPlayerId = null;
  state.dragPointerId = null;
  savePlayers();
  renderPlayers();
}

function updatePlayerPosition(playerId, event) {
  const pitchRect = elements.pitch.getBoundingClientRect();
  const x = clamp(((event.clientX - pitchRect.left) / pitchRect.width) * 100, 6, 94);
  const y = clamp(((event.clientY - pitchRect.top) / pitchRect.height) * 100, 6, 94);

  state.players = state.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          x,
          y,
        }
      : player
  );

  renderPlayers();
}

function showError(message) {
  elements.formError.textContent = message;
}

function clearError() {
  elements.formError.textContent = "";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createPlayerId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
