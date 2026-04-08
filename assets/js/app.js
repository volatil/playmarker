const POSITION_OPTIONS = ["arquero", "defensa", "medio", "delantero"];
const STATE_QUERY_KEY = "s";
const POSITION_CODES = { arquero: "0", defensa: "1", medio: "2", delantero: "3" };
const CODE_TO_POSITION = { 0: "arquero", 1: "defensa", 2: "medio", 3: "delantero" };
const TEAM_CODES = { home: "h", away: "a" };
const CODE_TO_TEAM = { h: "home", a: "away" };
const ZONE_CODES = { pitch: "p", bench: "b" };
const CODE_TO_ZONE = { p: "pitch", b: "bench" };

const DEFAULT_POSITION = {
  pitch: {
    home: { x: 50, y: 72 },
    away: { x: 50, y: 28 },
  },
  bench: {
    home: { x: 18, y: 50 },
    away: { x: 18, y: 78 },
  },
};

const PLACEMENT_BOUNDS = {
  pitch: {
    x: { min: 5, max: 95 },
    y: { min: 4, max: 96 },
  },
  bench: {
    x: { min: 6, max: 94 },
    y: { min: 12, max: 88 },
  },
};

const appShell = document.querySelector(".app-shell");
const TABLAS_ENDPOINT = appShell?.dataset.tablasEndpoint || "";
const TABLA_TEMPLATE = appShell?.dataset.tablaTemplate || "";
const OPEN_TABLA_TEMPLATE = appShell?.dataset.openTablaTemplate || "";

const state = {
  boards: [],
  activeBoardId: null,
  selectedPlayerId: null,
  draggingPlayerId: null,
  dragPointerId: null,
  isLoading: true,
  isSaving: false,
  saveStatus: {
    message: "Cargando tablas...",
    tone: "",
  },
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
  benchLayer: document.querySelector("#bench-layer"),
  pitch: document.querySelector("#pitch"),
  bench: document.querySelector("#bench"),
  formTitle: document.querySelector("#form-title"),
  submitButton: document.querySelector("#submit-button"),
  deleteButton: document.querySelector("#delete-player"),
  cancelEditButton: document.querySelector("#cancel-edit"),
  resetBoardButton: document.querySelector("#reset-board"),
  formError: document.querySelector("#form-error"),
  playerItemTemplate: document.querySelector("#player-item-template"),
  boardsTabs: document.querySelector("#boards-tabs"),
  addBoardButton: document.querySelector("#add-board"),
  renameBoardButton: document.querySelector("#rename-board"),
  deleteBoardButton: document.querySelector("#delete-board"),
  saveBoardButton: document.querySelector("#save-board"),
  boardSaveStatus: document.querySelector("#board-save-status"),
};

elements.playerForm.addEventListener("submit", handleFormSubmit);
elements.deleteButton.addEventListener("click", handleDeleteSelected);
elements.cancelEditButton.addEventListener("click", resetForm);
elements.resetBoardButton.addEventListener("click", handleResetBoard);
elements.addBoardButton.addEventListener("click", handleCreateBoard);
elements.renameBoardButton.addEventListener("click", handleRenameBoard);
elements.deleteBoardButton.addEventListener("click", handleDeleteBoard);
elements.saveBoardButton.addEventListener("click", handleSaveBoard);
document.addEventListener("pointerdown", handleDocumentPointerDown);
window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", stopDragging);
window.addEventListener("pointercancel", stopDragging);
window.addEventListener("resize", renderPlayers);

bootstrap();

async function bootstrap() {
  render();

  try {
    const boards = await loadBoardsFromApi();

    if (boards.length > 0) {
      state.boards = boards;
      state.activeBoardId = boards[0].id;
      setSaveStatus("Tablas cargadas.", "success");
      syncUrlFromState();
      render();
      return;
    }

    const createdBoard = await createBoardOnServer(`Board ${state.boards.length + 1}`, []);
    state.boards = [createdBoard];
    state.activeBoardId = createdBoard.id;
    setSaveStatus("Tabla inicial creada.", "success");
  } catch (error) {
    const fallbackBoard = createLocalBoard({ name: "Board 1" });
    state.boards = [fallbackBoard];
    state.activeBoardId = fallbackBoard.id;
    setSaveStatus("No se pudo cargar la base de datos. Puedes seguir y guardar manualmente.", "error");
  } finally {
    state.isLoading = false;
    syncUrlFromState();
    render();
  }
}

async function loadBoardsFromApi() {
  const response = await apiFetch(TABLAS_ENDPOINT, { method: "GET" });
  return Array.isArray(response.tablas) ? response.tablas.map(normalizeServerBoard).filter(Boolean) : [];
}

function normalizeServerBoard(board) {
  if (!board || typeof board !== "object") {
    return null;
  }

  const id = String(board.id || "").trim();
  if (!id) {
    return null;
  }

  const players = Array.isArray(board.players)
    ? board.players.map(normalizeStoredPlayer).filter(Boolean)
    : [];

  return {
    id,
    name: sanitizeBoardName(board.name) || "Board",
    players,
    createdAt: typeof board.createdAt === "string" ? board.createdAt : new Date().toISOString(),
    updatedAt: typeof board.updatedAt === "string" ? board.updatedAt : new Date().toISOString(),
    lastOpenedAt: typeof board.lastOpenedAt === "string" ? board.lastOpenedAt : null,
    shareCode: typeof board.shareCode === "string" ? board.shareCode : null,
    isPublic: Boolean(board.isPublic),
    isDirty: false,
    isNew: false,
  };
}

function createLocalBoard({ name, players = [] } = {}) {
  const now = new Date().toISOString();
  return {
    id: createEntityId("tmp"),
    name: sanitizeBoardName(name) || `Board ${state.boards.length + 1}`,
    players: players.map((player) => ({
      ...player,
      ...clampPlacementCoordinates(player.zone, player.x, player.y),
    })),
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    shareCode: null,
    isPublic: false,
    isDirty: true,
    isNew: true,
  };
}

function createBoardStatePayload(board) {
  return {
    version: 1,
    name: board.name,
    players: board.players.map((player) => ({
      id: player.id,
      name: player.name,
      number: player.number,
      position: player.position,
      team: player.team,
      zone: player.zone,
      x: Number(player.x.toFixed(2)),
      y: Number(player.y.toFixed(2)),
    })),
  };
}

async function createBoardOnServer(name, players = []) {
  const response = await apiFetch(TABLAS_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({
      name,
      state: {
        version: 1,
        name,
        players,
      },
    }),
  });

  return normalizeServerBoard(response.tabla);
}

async function saveBoardOnServer(board) {
  if (board.isNew) {
    const response = await apiFetch(TABLAS_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        name: board.name,
        state: createBoardStatePayload(board),
      }),
    });

    return normalizeServerBoard(response.tabla);
  }

  const response = await apiFetch(buildBoardUrl(board.id), {
    method: "PUT",
    body: JSON.stringify({
      name: board.name,
      state: createBoardStatePayload(board),
    }),
  });

  return normalizeServerBoard(response.tabla);
}

async function deleteBoardOnServer(boardId) {
  await apiFetch(buildBoardUrl(boardId), {
    method: "DELETE",
  });
}

async function markBoardOpened(boardId) {
  const response = await apiFetch(buildOpenBoardUrl(boardId), {
    method: "POST",
  });

  return normalizeServerBoard(response.tabla);
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok || !data || data.success === false) {
    throw new Error((data && data.message) || "No se pudo completar la solicitud.");
  }

  return data;
}

function buildBoardUrl(boardId) {
  return TABLA_TEMPLATE.replace("__TABLA_ID__", encodeURIComponent(boardId));
}

function buildOpenBoardUrl(boardId) {
  return OPEN_TABLA_TEMPLATE.replace("__TABLA_ID__", encodeURIComponent(boardId));
}

function normalizeStoredPlayer(player) {
  if (!player || typeof player !== "object") {
    return null;
  }

  const parsedPlayer = {
    id: String(player.id || ""),
    name: String(player.name || ""),
    number: String(player.number || ""),
    position: normalizePosition(player.position),
    team: String(player.team || ""),
    zone: player.zone === "bench" ? "bench" : "pitch",
    x: Number(player.x),
    y: Number(player.y),
  };

  if (!isValidUrlPlayer(parsedPlayer)) {
    return null;
  }

  return {
    ...parsedPlayer,
    ...clampPlacementCoordinates(parsedPlayer.zone, parsedPlayer.x, parsedPlayer.y),
  };
}

function isValidUrlPlayer(player) {
  return (
    player &&
    typeof player.id === "string" &&
    player.id.trim() !== "" &&
    typeof player.name === "string" &&
    typeof player.number === "string" &&
    typeof player.position === "string" &&
    player.position !== "" &&
    (player.zone === "pitch" || player.zone === "bench") &&
    (player.team === "home" || player.team === "away") &&
    Number.isFinite(player.x) &&
    Number.isFinite(player.y)
  );
}

function serializeCompactPlayer(player) {
  return [
    player.id,
    player.name,
    player.number,
    POSITION_CODES[player.position],
    TEAM_CODES[player.team],
    ZONE_CODES[player.zone],
    Number(player.x.toFixed(2)),
    Number(player.y.toFixed(2)),
  ];
}

function syncUrlFromState() {
  const nextUrl = new URL(window.location.href);
  const activeBoard = getActiveBoard();
  const compactState = activeBoard ? activeBoard.players.map(serializeCompactPlayer) : [];
  nextUrl.search = compactState.length > 0 ? `?${STATE_QUERY_KEY}=${encodeBase64Url(JSON.stringify(compactState))}` : "";

  const nextRelativeUrl = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextRelativeUrl !== currentRelativeUrl) {
    history.replaceState(null, "", nextRelativeUrl);
  }
}

function getActiveBoard() {
  return state.boards.find((board) => board.id === state.activeBoardId) || null;
}

function getActivePlayers() {
  const activeBoard = getActiveBoard();
  return activeBoard ? activeBoard.players : [];
}

function replaceBoard(updatedBoard, previousBoard = null) {
  state.boards = state.boards.map((board) => {
    if (board.id === (previousBoard ? previousBoard.id : updatedBoard.id)) {
      return {
        ...updatedBoard,
        isDirty: false,
        isNew: false,
      };
    }

    return board;
  });

  if (previousBoard && state.activeBoardId === previousBoard.id) {
    state.activeBoardId = updatedBoard.id;
  }
}

function updateActiveBoard(updater, { markDirty = true } = {}) {
  const activeBoard = getActiveBoard();
  if (!activeBoard) {
    return;
  }

  const updatedBoard = updater(activeBoard);
  if (!updatedBoard) {
    return;
  }

  state.boards = state.boards.map((board) =>
    board.id === activeBoard.id
      ? normalizeBoardTimestamps({
          ...updatedBoard,
          isDirty: markDirty ? true : Boolean(updatedBoard.isDirty),
          isNew: Boolean(updatedBoard.isNew),
        }, board)
      : board
  );

  if (markDirty) {
    setSaveStatus("Cambios sin guardar.", "warning");
  }

  syncUrlFromState();
}

function normalizeBoardTimestamps(nextBoard, previousBoard) {
  return {
    ...nextBoard,
    createdAt: previousBoard.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeBoardName(value) {
  return String(value || "").trim().slice(0, 64);
}

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function handleFormSubmit(event) {
  event.preventDefault();
  clearError();

  const formData = new FormData(elements.playerForm);
  const payload = {
    id: String(formData.get("playerId") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    number: String(formData.get("number") || "").trim(),
    position: normalizePosition(formData.get("position")),
    team: String(formData.get("team") || "home"),
  };

  const validationError = validatePlayer(payload);
  if (validationError) {
    showError(validationError);
    return;
  }

  if (payload.id) {
    updateActiveBoard((board) => ({
      ...board,
      players: board.players.map((player) =>
        player.id === payload.id
          ? {
              ...player,
              name: payload.name,
              number: payload.number,
              position: payload.position,
              team: payload.team,
            }
          : player
      ),
    }));
    state.selectedPlayerId = payload.id;
  } else {
    const { x, y } = getNextSpawnPosition(payload.team);
    const newPlayer = {
      id: createEntityId("p"),
      name: payload.name,
      number: payload.number,
      position: payload.position,
      team: payload.team,
      zone: "pitch",
      x,
      y,
    };

    updateActiveBoard((board) => ({
      ...board,
      players: [...board.players, newPlayer],
    }));
    state.selectedPlayerId = null;
  }

  if (!payload.id) {
    elements.playerForm.reset();
    elements.playerPosition.value = "arquero";
    elements.playerTeam.value = "home";
  }

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

  if (!POSITION_OPTIONS.includes(player.position)) {
    return "La posicion debe ser arquero, defensa, medio o delantero.";
  }

  if (player.team !== "home" && player.team !== "away") {
    return "Selecciona un equipo valido.";
  }

  return "";
}

function getNextSpawnPosition(team) {
  const teamPlayers = getActivePlayers().filter((player) => player.team === team && player.zone === "pitch");
  const base = DEFAULT_POSITION.pitch[team];
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

  handleDeletePlayer(state.selectedPlayerId);
}

function handleDeletePlayer(playerId) {
  updateActiveBoard((board) => ({
    ...board,
    players: board.players.filter((player) => player.id !== playerId),
  }));

  if (state.selectedPlayerId === playerId) {
    state.selectedPlayerId = null;
  }

  render();
}

function handleResetBoard() {
  updateActiveBoard((board) => ({
    ...board,
    players: [],
  }));
  state.selectedPlayerId = null;
  state.draggingPlayerId = null;
  state.dragPointerId = null;
  render();
}

async function handleCreateBoard() {
  const nextBoardNumber = state.boards.length + 1;
  const providedName = window.prompt("Nombre del nuevo board:", `Board ${nextBoardNumber}`);
  if (providedName === null) {
    return;
  }

  const boardName = sanitizeBoardName(providedName) || `Board ${nextBoardNumber}`;
  clearError();
  setSaveStatus("Creando nueva tabla...", "warning");

  try {
    const newBoard = await createBoardOnServer(boardName, []);
    state.boards = [...state.boards, newBoard];
    state.activeBoardId = newBoard.id;
    state.selectedPlayerId = null;
    state.draggingPlayerId = null;
    state.dragPointerId = null;
    setSaveStatus("Tabla creada.", "success");
    syncUrlFromState();
    render();
  } catch (error) {
    setSaveStatus(error.message, "error");
    render();
  }
}

function handleRenameBoard() {
  const activeBoard = getActiveBoard();
  if (!activeBoard) {
    return;
  }

  const providedName = window.prompt("Nuevo nombre del board:", activeBoard.name);
  if (providedName === null) {
    return;
  }

  const nextName = sanitizeBoardName(providedName);
  if (!nextName) {
    showError("El board debe tener un nombre.");
    return;
  }

  clearError();
  updateActiveBoard((board) => ({
    ...board,
    name: nextName,
  }));
  render();
}

async function handleDeleteBoard() {
  const activeBoard = getActiveBoard();
  if (!activeBoard) {
    return;
  }

  const confirmed = window.confirm(`Eliminar "${activeBoard.name}"?`);
  if (!confirmed) {
    return;
  }

  try {
    if (!activeBoard.isNew) {
      setSaveStatus("Eliminando tabla...", "warning");
      await deleteBoardOnServer(activeBoard.id);
    }

    const currentBoardIndex = state.boards.findIndex((board) => board.id === activeBoard.id);
    const remainingBoards = state.boards.filter((board) => board.id !== activeBoard.id);
    state.boards = remainingBoards;

    if (remainingBoards.length === 0) {
      let replacementBoard = null;
      try {
        replacementBoard = await createBoardOnServer("Board 1", []);
      } catch (error) {
        replacementBoard = createLocalBoard({ name: "Board 1" });
      }

      state.boards = [replacementBoard];
      state.activeBoardId = replacementBoard.id;
      setSaveStatus(
        replacementBoard.isNew
          ? "Tabla eliminada. Se preparo una nueva tabla local; guardala para persistirla."
          : "Tabla eliminada. Se creo una nueva tabla vacia.",
        replacementBoard.isNew ? "warning" : "success"
      );
    } else {
      const nextBoard = remainingBoards[Math.max(0, currentBoardIndex - 1)] || remainingBoards[0];
      state.activeBoardId = nextBoard ? nextBoard.id : null;
      setSaveStatus("Tabla eliminada.", "success");
      if (nextBoard) {
        await syncBoardOpenState(nextBoard.id);
      }
    }

    state.selectedPlayerId = null;
    state.draggingPlayerId = null;
    state.dragPointerId = null;
    clearError();
    syncUrlFromState();
    render();
  } catch (error) {
    setSaveStatus(error.message, "error");
    render();
  }
}

async function handleSaveBoard() {
  if (state.isSaving) {
    return;
  }

  const activeBoard = getActiveBoard();
  if (!activeBoard) {
    return;
  }

  state.isSaving = true;
  clearError();
  setSaveStatus("Guardando tabla...", "warning");
  render();

  try {
    const savedBoard = await saveBoardOnServer(activeBoard);
    replaceBoard(savedBoard, activeBoard);
    setSaveStatus("Tabla guardada.", "success");
    syncUrlFromState();
  } catch (error) {
    setSaveStatus(error.message, "error");
  } finally {
    state.isSaving = false;
    render();
  }
}

async function selectBoard(boardId) {
  if (boardId === state.activeBoardId) {
    return;
  }

  state.activeBoardId = boardId;
  state.selectedPlayerId = null;
  state.draggingPlayerId = null;
  state.dragPointerId = null;
  clearError();
  syncUrlFromState();

  const activeBoard = getActiveBoard();
  setSaveStatus(activeBoard?.isDirty ? "Cambios sin guardar." : "Tabla cargada.", activeBoard?.isDirty ? "warning" : "");
  render();

  try {
    await syncBoardOpenState(boardId);
  } catch (error) {
    setSaveStatus(error.message, "error");
    render();
  }
}

async function syncBoardOpenState(boardId) {
  const openedBoard = await markBoardOpened(boardId);
  if (!openedBoard) {
    return;
  }

  state.boards = state.boards.map((board) =>
    board.id === openedBoard.id
      ? {
          ...board,
          lastOpenedAt: openedBoard.lastOpenedAt,
        }
      : board
  );
}

function selectPlayer(playerId) {
  state.selectedPlayerId = playerId;
  clearError();
  render();
}

function clearSelection() {
  if (!state.selectedPlayerId) {
    return;
  }

  state.selectedPlayerId = null;
  clearError();
  elements.playerForm.reset();
  elements.playerPosition.value = "arquero";
  elements.playerTeam.value = "home";
  render();
}

function resetForm() {
  state.selectedPlayerId = null;
  clearError();
  elements.playerForm.reset();
  elements.playerPosition.value = "arquero";
  elements.playerTeam.value = "home";
  syncForm();
  renderPlayers();
  renderPlayerList();
}

function syncForm() {
  const selectedPlayer = getActivePlayers().find((player) => player.id === state.selectedPlayerId);

  if (!selectedPlayer) {
    elements.formTitle.textContent = "Crear jugador";
    elements.submitButton.textContent = "Agregar jugador";
    elements.deleteButton.classList.add("hidden");
    elements.cancelEditButton.classList.add("hidden");
    elements.playerId.value = "";
    if (!document.activeElement || document.activeElement === document.body) {
      elements.playerForm.reset();
      elements.playerPosition.value = "arquero";
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
  renderBoardsTabs();
  syncForm();
  renderPlayerList();
  renderPlayers();
  renderSaveStatus();
  renderActionStates();
}

function renderSaveStatus() {
  if (!elements.boardSaveStatus) {
    return;
  }

  elements.boardSaveStatus.textContent = state.saveStatus.message || "";
  elements.boardSaveStatus.className = `board-save-status${state.saveStatus.tone ? ` is-${state.saveStatus.tone}` : ""}`;
}

function renderActionStates() {
  const activeBoard = getActiveBoard();
  const canMutate = !state.isLoading && Boolean(activeBoard);
  const canSave = canMutate && !state.isSaving && Boolean(activeBoard?.isDirty || activeBoard?.isNew);

  elements.saveBoardButton.disabled = !canSave;
  elements.addBoardButton.disabled = state.isLoading || state.isSaving;
  elements.renameBoardButton.disabled = !canMutate || state.isSaving;
  elements.deleteBoardButton.disabled = !canMutate || state.isSaving;
  elements.resetBoardButton.disabled = !canMutate || state.isSaving;
  elements.submitButton.disabled = !canMutate || state.isSaving;
  elements.deleteButton.disabled = !canMutate || state.isSaving || !state.selectedPlayerId;
  elements.cancelEditButton.disabled = !canMutate || state.isSaving;
}

function renderBoardsTabs() {
  elements.boardsTabs.innerHTML = "";
  const fragment = document.createDocumentFragment();

  state.boards.forEach((board) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "board-tab";
    button.classList.toggle("is-active", board.id === state.activeBoardId);
    button.classList.toggle("is-dirty", Boolean(board.isDirty || board.isNew));
    button.textContent = board.name;
    button.title = board.name;
    button.disabled = state.isLoading;
    button.addEventListener("click", () => {
      void selectBoard(board.id);
    });
    fragment.appendChild(button);
  });

  elements.boardsTabs.appendChild(fragment);
}

function renderPlayerList() {
  elements.playerList.innerHTML = "";
  const activePlayers = getActivePlayers();
  elements.emptyState.classList.toggle("hidden", activePlayers.length > 0);

  const fragment = document.createDocumentFragment();

  activePlayers.forEach((player) => {
    const item = elements.playerItemTemplate.content.firstElementChild.cloneNode(true);
    const summaryButton = item.querySelector(".player-summary");
    const editButton = item.querySelector(".edit-button");
    const deleteButton = item.querySelector(".delete-button");
    const selected = player.id === state.selectedPlayerId;
    const teamLabel = player.team === "home" ? "Local" : "Visita";
    const positionLabel = formatPosition(player.position);
    const positionStyle = getPositionStyle(player.position);

    summaryButton.classList.toggle("is-active", selected);
    summaryButton.style.setProperty("--player-position-accent", positionStyle.accent);
    summaryButton.style.setProperty("--player-position-border", positionStyle.border);
    summaryButton.innerHTML = `
      <div class="summary-top">
        <span class="summary-name">${escapeHtml(player.name)}</span>
        <span class="summary-number">#${escapeHtml(player.number)}</span>
      </div>
      <div class="summary-bottom">
        <span class="summary-position position-${player.position}">${positionLabel}</span>
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
  elements.benchLayer.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const benchFragment = document.createDocumentFragment();

  getActivePlayers().forEach((player) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "player-marker";
    marker.dataset.playerId = player.id;
    marker.dataset.team = player.team;
    marker.dataset.zone = player.zone;
    marker.dataset.position = player.position;
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

    if (player.zone === "bench") {
      benchFragment.appendChild(marker);
    } else {
      fragment.appendChild(marker);
    }
  });

  elements.playersLayer.appendChild(fragment);
  elements.benchLayer.appendChild(benchFragment);
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
  renderPlayers();
}

function handleDocumentPointerDown(event) {
  if (!state.selectedPlayerId || state.draggingPlayerId) {
    return;
  }

  const interactiveTarget = event.target.closest(
    ".player-marker, .player-summary, .edit-button, .delete-button, #player-form, #cancel-edit, #delete-player, #reset-board, .board-tab, #add-board, #rename-board, #delete-board, #save-board"
  );

  if (!interactiveTarget) {
    clearSelection();
  }
}

function updatePlayerPosition(playerId, event) {
  const nextPlacement = resolveBoardPlacement(event);

  updateActiveBoard((board) => ({
    ...board,
    players: board.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            zone: nextPlacement.zone,
            x: nextPlacement.x,
            y: nextPlacement.y,
          }
        : player
    ),
  }));

  renderPlayers();
  renderBoardsTabs();
  renderSaveStatus();
  renderActionStates();
}

function setSaveStatus(message, tone = "") {
  state.saveStatus = { message, tone };
}

function showError(message) {
  elements.formError.textContent = message;
}

function clearError() {
  elements.formError.textContent = "";
}

function normalizePosition(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return POSITION_OPTIONS.includes(normalized) ? normalized : "";
}

function formatPosition(position) {
  if (position === "arquero") {
    return "Arquero";
  }

  if (position === "defensa") {
    return "Defensa";
  }

  if (position === "medio") {
    return "Medio";
  }

  return "Delantero";
}

function getPositionStyle(position) {
  if (position === "arquero") {
    return { accent: "rgba(6, 182, 212, 0.45)", border: "rgba(6, 182, 212, 0.28)" };
  }

  if (position === "defensa") {
    return { accent: "rgba(34, 197, 94, 0.45)", border: "rgba(34, 197, 94, 0.28)" };
  }

  if (position === "medio") {
    return { accent: "rgba(245, 158, 11, 0.45)", border: "rgba(245, 158, 11, 0.28)" };
  }

  return { accent: "rgba(239, 68, 68, 0.45)", border: "rgba(239, 68, 68, 0.28)" };
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

function createEntityId(prefix) {
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    const randomBytes = new Uint8Array(4);
    window.crypto.getRandomValues(randomBytes);
    const randomSuffix = Array.from(randomBytes, (byte) => byte.toString(36).padStart(2, "0")).join("");
    return `${prefix}${Date.now().toString(36)}${randomSuffix}`;
  }

  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function resolveBoardPlacement(event) {
  const areas = [
    { zone: "pitch", rect: elements.pitch.getBoundingClientRect() },
    { zone: "bench", rect: elements.benchLayer.getBoundingClientRect() },
  ];

  const containingArea =
    areas.find(({ rect }) => isPointWithinRect(event.clientX, event.clientY, rect)) || nearestArea(event.clientX, event.clientY, areas);

  return {
    zone: containingArea.zone,
    ...clampPlacementCoordinates(
      containingArea.zone,
      ((event.clientX - containingArea.rect.left) / containingArea.rect.width) * 100,
      ((event.clientY - containingArea.rect.top) / containingArea.rect.height) * 100
    ),
  };
}

function clampPlacementCoordinates(zone, x, y) {
  const bounds = PLACEMENT_BOUNDS[zone] || PLACEMENT_BOUNDS.pitch;
  return {
    x: clamp(x, bounds.x.min, bounds.x.max),
    y: clamp(y, bounds.y.min, bounds.y.max),
  };
}

function isPointWithinRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function nearestArea(x, y, areas) {
  return areas.reduce((closest, area) => {
    const centerX = area.rect.left + area.rect.width / 2;
    const centerY = area.rect.top + area.rect.height / 2;
    const distance = Math.hypot(x - centerX, y - centerY);
    if (!closest || distance < closest.distance) {
      return { ...area, distance };
    }
    return closest;
  }, null);
}
