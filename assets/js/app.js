const POSITION_OPTIONS = ["arquero", "defensa", "medio", "delantero"];
const BOARD_QUERY_KEY = "tablero";

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
const PAGE_MODE = appShell?.dataset.pageMode || "landing";
const IS_AUTHENTICATED = appShell?.dataset.isAuthenticated === "1";
const INITIAL_BOARD_ID = String(appShell?.dataset.initialBoardId || "").trim();
const TABLAS_ENDPOINT = appShell?.dataset.tablasEndpoint || "";
const SHARED_TABLA_TEMPLATE = appShell?.dataset.sharedTablaTemplate || "";
const TABLA_TEMPLATE = appShell?.dataset.tablaTemplate || "";
const OPEN_TABLA_TEMPLATE = appShell?.dataset.openTablaTemplate || "";

const landingElements = {
  createBoardButton: document.querySelector("#landing-create-board"),
  createStatus: document.querySelector("#landing-create-status"),
};

const state = {
  isAuthenticated: IS_AUTHENTICATED,
  boards: [],
  activeBoardId: null,
  selectedPlayerId: null,
  draggingPlayerId: null,
  dragPointerId: null,
  isLoading: true,
  isSaving: false,
  isUpdatingVisibility: false,
  saveStatus: {
    message: "Cargando tablas...",
    tone: "",
  },
  sharedAccess: {
    message: "",
    tone: "",
    isBlocking: false,
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
  pitchCount: document.querySelector("#pitch-count"),
  benchCount: document.querySelector("#bench-count"),
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
  boardVisibilityToggle: document.querySelector("#board-visibility-toggle"),
  boardVisibilityInput: document.querySelector("#board-visibility-input"),
  boardVisibilityValue: document.querySelector("#board-visibility-value"),
  sharedBoardMessage: document.querySelector("#shared-board-message"),
  boardLayout: document.querySelector("#board-layout"),
};

if (PAGE_MODE === "board") {
  elements.playerForm.addEventListener("submit", handleFormSubmit);
  elements.deleteButton.addEventListener("click", handleDeleteSelected);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.resetBoardButton.addEventListener("click", handleResetBoard);
  elements.addBoardButton.addEventListener("click", handleCreateBoard);
  elements.renameBoardButton.addEventListener("click", handleRenameBoard);
  elements.deleteBoardButton.addEventListener("click", handleDeleteBoard);
  elements.saveBoardButton.addEventListener("click", handleSaveBoard);
  elements.boardVisibilityInput.addEventListener("change", handleVisibilityToggle);
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", stopDragging);
  window.addEventListener("pointercancel", stopDragging);
  window.addEventListener("resize", renderPlayers);

  bootstrap();
} else {
  setupLandingPage();
}

function setupLandingPage() {
  if (!landingElements.createBoardButton) {
    return;
  }

  landingElements.createBoardButton.addEventListener("click", () => {
    void handleLandingCreateBoard();
  });
}

async function handleLandingCreateBoard() {
  if (!landingElements.createBoardButton) {
    return;
  }

  landingElements.createBoardButton.disabled = true;
  setLandingStatus("Creando tu tablero...", "info");

  try {
    const createdBoard = await createBoardOnServer("Board 1", []);
    window.location.href = buildBoardPageUrl(createdBoard.id);
  } catch (error) {
    setLandingStatus(error.message || "No se pudo crear el tablero.", "error");
    landingElements.createBoardButton.disabled = false;
  }
}

async function bootstrap() {
  render();

  let boards = [];

  try {
    if (state.isAuthenticated) {
      boards = await loadBoardsFromApi();
    }

    if (INITIAL_BOARD_ID !== "") {
      await initializeFromRequestedBoard(boards, INITIAL_BOARD_ID);
      return;
    }

    if (boards.length > 0) {
      state.boards = boards;
      state.activeBoardId = boards[0].id;
      clearSharedAccess();
      setSaveStatus("Tablas cargadas.", "success");
      syncUrlFromActiveBoard();
      render();
      return;
    }

    if (state.isAuthenticated) {
      const createdBoard = await createBoardOnServer(`Board ${state.boards.length + 1}`, []);
      state.boards = [createdBoard];
      state.activeBoardId = createdBoard.id;
      clearSharedAccess();
      setSaveStatus("Tabla inicial creada.", "success");
      return;
    }

    setSharedAccess("No se encontro el tablero compartido solicitado.", "error", true);
    setSaveStatus("No hay una tabla disponible para mostrar.", "error");
  } catch (error) {
    if (state.isAuthenticated) {
      const fallbackBoard = createLocalBoard({ name: "Board 1" });
      state.boards = [fallbackBoard];
      state.activeBoardId = fallbackBoard.id;
      clearSharedAccess();
      setSaveStatus("No se pudo cargar la base de datos. Puedes seguir y guardar manualmente.", "error");
    } else {
      setSharedAccess(error.message || "No se pudo abrir el tablero compartido.", "error", true);
      setSaveStatus(error.message || "No se pudo abrir el tablero compartido.", "error");
    }
  } finally {
    state.isLoading = false;
    syncUrlFromActiveBoard();
    render();
  }
}

async function loadBoardsFromApi() {
  const response = await apiFetch(TABLAS_ENDPOINT, { method: "GET" });
  return Array.isArray(response.tablas) ? response.tablas.map(normalizeServerBoard).filter(Boolean) : [];
}

async function loadSharedBoardFromApi(boardId) {
  const response = await apiFetch(buildSharedBoardUrl(boardId), { method: "GET" });
  return normalizeServerBoard(response.tabla, { canEdit: false });
}

async function initializeFromRequestedBoard(boards, boardId) {
  try {
    const sharedBoard = await loadSharedBoardFromApi(boardId);
    const ownedBoard = boards.find((board) => board.id === boardId) || null;

    if (ownedBoard) {
      state.boards = boards;
      state.activeBoardId = ownedBoard.id;
      clearSharedAccess();
      setSaveStatus("Tabla cargada.", "success");
      syncUrlFromActiveBoard();
      render();
      return;
    }

    state.boards = [sharedBoard, ...boards];
    state.activeBoardId = sharedBoard.id;
    clearSharedAccess();
    setSaveStatus("Tabla compartida cargada.", "success");
    syncUrlFromActiveBoard();
    render();
  } catch (error) {
    state.boards = boards;
    state.activeBoardId = null;
    setSharedAccess(error.message || "No se pudo abrir el tablero compartido.", "error", true);
    setSaveStatus(error.message || "No se pudo abrir el tablero compartido.", "error");
  }
}

function normalizeServerBoard(board, { canEdit = true } = {}) {
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
    canEdit,
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
    canEdit: true,
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

async function updateBoardVisibilityOnServer(boardId, isPublic) {
  const response = await apiFetch(buildBoardUrl(boardId), {
    method: "PUT",
    body: JSON.stringify({
      isPublic,
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
    const error = new Error((data && data.message) || "No se pudo completar la solicitud.");
    error.status = response.status;
    throw error;
  }

  return data;
}

function buildBoardPageUrl(boardId) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(BOARD_QUERY_KEY, boardId);
  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}

function buildBoardUrl(boardId) {
  return TABLA_TEMPLATE.replace("__TABLA_ID__", encodeURIComponent(boardId));
}

function buildSharedBoardUrl(boardId) {
  return SHARED_TABLA_TEMPLATE.replace("__TABLA_ID__", encodeURIComponent(boardId));
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

function syncUrlFromActiveBoard() {
  if (state.sharedAccess.isBlocking) {
    return;
  }

  const nextUrl = new URL(window.location.href);
  const activeBoard = getActiveBoard();
  if (activeBoard && !activeBoard.isNew) {
    nextUrl.searchParams.set(BOARD_QUERY_KEY, activeBoard.id);
  } else {
    nextUrl.searchParams.delete(BOARD_QUERY_KEY);
  }

  const nextRelativeUrl = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextRelativeUrl !== currentRelativeUrl) {
    history.replaceState(null, "", nextRelativeUrl);
  }
}

function getActiveBoard() {
  return state.boards.find((board) => board.id === state.activeBoardId) || null;
}

function canEditActiveBoard() {
  const activeBoard = getActiveBoard();
  return Boolean(state.isAuthenticated && activeBoard && activeBoard.canEdit && !state.sharedAccess.isBlocking);
}

function getActivePlayers() {
  const activeBoard = getActiveBoard();
  return activeBoard ? activeBoard.players : [];
}

function getActivePlayerZoneCounts() {
  return getActivePlayers().reduce(
    (counts, player) => {
      if (player.zone === "bench") {
        counts.bench += 1;
      } else {
        counts.pitch += 1;
      }

      return counts;
    },
    { pitch: 0, bench: 0 },
  );
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

  syncUrlFromActiveBoard();
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

function handleFormSubmit(event) {
  event.preventDefault();
  if (!canEditActiveBoard()) {
    return;
  }
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
  if (!canEditActiveBoard() || !state.selectedPlayerId) {
    return;
  }

  handleDeletePlayer(state.selectedPlayerId);
}

function handleDeletePlayer(playerId) {
  if (!canEditActiveBoard()) {
    return;
  }

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
  if (!canEditActiveBoard()) {
    return;
  }

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
  if (!state.isAuthenticated || state.isSaving || state.isLoading) {
    return;
  }

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
    clearSharedAccess();
    setSaveStatus("Tabla creada.", "success");
    syncUrlFromActiveBoard();
    render();
  } catch (error) {
    setSaveStatus(error.message, "error");
    render();
  }
}

function handleRenameBoard() {
  const activeBoard = getActiveBoard();
  if (!activeBoard || !canEditActiveBoard()) {
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
  if (!activeBoard || !canEditActiveBoard()) {
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
    clearSharedAccess();
    syncUrlFromActiveBoard();
    render();
  } catch (error) {
    setSaveStatus(error.message, "error");
    render();
  }
}

async function handleSaveBoard() {
  if (state.isSaving || !canEditActiveBoard()) {
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
    clearSharedAccess();
    setSaveStatus("Tabla guardada.", "success");
    syncUrlFromActiveBoard();
  } catch (error) {
    setSaveStatus(error.message, "error");
  } finally {
    state.isSaving = false;
    render();
  }
}

async function handleVisibilityToggle(event) {
  const activeBoard = getActiveBoard();
  if (!activeBoard || !canEditActiveBoard()) {
    event.target.checked = Boolean(activeBoard?.isPublic);
    return;
  }

  if (activeBoard.isNew) {
    event.target.checked = Boolean(activeBoard.isPublic);
    setSaveStatus("Debes guardar el tablero en el servidor antes de cambiar su visibilidad.", "warning");
    render();
    return;
  }

  const nextVisibility = event.target.checked;
  const previousVisibility = Boolean(activeBoard.isPublic);

  if (nextVisibility === previousVisibility) {
    return;
  }

  state.isUpdatingVisibility = true;
  updateActiveBoard(
    (board) => ({
      ...board,
      isPublic: nextVisibility,
    }),
    { markDirty: false }
  );
  setSaveStatus(nextVisibility ? "Haciendo publico el tablero..." : "Haciendo privado el tablero...", "warning");
  render();

  try {
    const updatedBoard = await updateBoardVisibilityOnServer(activeBoard.id, nextVisibility);
    applyBoardVisibilityUpdate(activeBoard.id, updatedBoard);
    setSaveStatus(updatedBoard.isPublic ? "El tablero ahora es publico." : "El tablero ahora es privado.", "success");
  } catch (error) {
    updateActiveBoard(
      (board) => ({
        ...board,
        isPublic: previousVisibility,
      }),
      { markDirty: false }
    );
    setSaveStatus(error.message || "No se pudo actualizar la visibilidad del tablero.", "error");
  } finally {
    state.isUpdatingVisibility = false;
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
  clearSharedAccess();
  syncUrlFromActiveBoard();

  const activeBoard = getActiveBoard();
  setSaveStatus(activeBoard?.isDirty ? "Cambios sin guardar." : "Tabla cargada.", activeBoard?.isDirty ? "warning" : "");
  render();

  try {
    if (activeBoard?.canEdit) {
      await syncBoardOpenState(boardId);
    }
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
  renderBoardVisibility();
  renderSharedBoardMessage();
  renderActionStates();
}

function renderSaveStatus() {
  if (!elements.boardSaveStatus) {
    return;
  }

  elements.boardSaveStatus.textContent = state.saveStatus.message || "";
  elements.boardSaveStatus.className = `board-save-status${state.saveStatus.tone ? ` is-${state.saveStatus.tone}` : ""}`;
}

function renderSharedBoardMessage() {
  if (!elements.sharedBoardMessage || !elements.boardLayout) {
    return;
  }

  const activeBoard = getActiveBoard();
  const blockingMessage = state.sharedAccess.message;
  const readonlyMessage = activeBoard && !activeBoard.canEdit && !state.sharedAccess.isBlocking
    ? "Estas viendo un tablero compartido en modo solo lectura."
    : "";
  const message = blockingMessage || readonlyMessage;
  const tone = blockingMessage ? state.sharedAccess.tone : readonlyMessage ? "warning" : "";

  elements.sharedBoardMessage.textContent = message;
  elements.sharedBoardMessage.className = `shared-board-message${tone ? ` is-${tone}` : ""}${message ? "" : " hidden"}`;
  elements.boardLayout.classList.toggle("hidden", state.sharedAccess.isBlocking);
}

function renderBoardVisibility() {
  if (!elements.boardVisibilityToggle || !elements.boardVisibilityInput || !elements.boardVisibilityValue) {
    return;
  }

  const activeBoard = getActiveBoard();
  const shouldShow = Boolean(
    state.isAuthenticated &&
      activeBoard &&
      activeBoard.canEdit &&
      !state.sharedAccess.isBlocking
  );

  elements.boardVisibilityToggle.classList.toggle("hidden", !shouldShow);

  if (!shouldShow) {
    elements.boardVisibilityInput.checked = false;
    elements.boardVisibilityValue.textContent = "Privado";
    return;
  }

  elements.boardVisibilityInput.checked = Boolean(activeBoard.isPublic);
  elements.boardVisibilityValue.textContent = activeBoard.isPublic ? "Publico" : "Privado";
}

function renderActionStates() {
  const activeBoard = getActiveBoard();
  const canMutate = !state.isLoading && canEditActiveBoard();
  const canCreate = state.isAuthenticated && !state.isLoading && !state.isSaving;
  const canSave = canMutate && !state.isSaving && Boolean(activeBoard?.isDirty || activeBoard?.isNew);
  const canToggleVisibility = canMutate && !state.isSaving && !state.isUpdatingVisibility && !activeBoard?.isNew;

  elements.saveBoardButton.disabled = !canSave;
  elements.addBoardButton.disabled = !canCreate;
  elements.renameBoardButton.disabled = !canMutate || state.isSaving;
  elements.deleteBoardButton.disabled = !canMutate || state.isSaving;
  elements.resetBoardButton.disabled = !canMutate || state.isSaving;
  elements.submitButton.disabled = !canMutate || state.isSaving;
  elements.deleteButton.disabled = !canMutate || state.isSaving || !state.selectedPlayerId;
  elements.cancelEditButton.disabled = !canMutate || state.isSaving;
  elements.playerName.disabled = !canMutate || state.isSaving;
  elements.playerNumber.disabled = !canMutate || state.isSaving;
  elements.playerPosition.disabled = !canMutate || state.isSaving;
  elements.playerTeam.disabled = !canMutate || state.isSaving;
  elements.boardVisibilityInput.disabled = !canToggleVisibility;
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
  const zoneCounts = getActivePlayerZoneCounts();
  elements.emptyState.classList.toggle("hidden", activePlayers.length > 0);
  elements.pitchCount.textContent = String(zoneCounts.pitch);
  elements.benchCount.textContent = String(zoneCounts.bench);

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
  if (!canEditActiveBoard()) {
    return;
  }

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
    ".player-marker, .player-summary, .edit-button, .delete-button, #player-form, #cancel-edit, #delete-player, #reset-board, .board-tab, #add-board, #rename-board, #delete-board, #save-board, #board-visibility-toggle"
  );

  if (!interactiveTarget) {
    clearSelection();
  }
}

function updatePlayerPosition(playerId, event) {
  if (!canEditActiveBoard()) {
    return;
  }

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

function setSharedAccess(message, tone = "", isBlocking = false) {
  state.sharedAccess = { message, tone, isBlocking };
}

function clearSharedAccess() {
  setSharedAccess("", "", false);
}

function setLandingStatus(message, tone = "") {
  if (!landingElements.createStatus) {
    return;
  }

  landingElements.createStatus.textContent = message || "";
  landingElements.createStatus.className = `landing-inline-status${tone ? ` is-${tone}` : ""}`;
}

function showError(message) {
  elements.formError.textContent = message;
}

function clearError() {
  elements.formError.textContent = "";
}

function applyBoardVisibilityUpdate(boardId, persistedBoard) {
  state.boards = state.boards.map((board) => {
    if (board.id !== boardId) {
      return board;
    }

    return {
      ...board,
      isPublic: Boolean(persistedBoard?.isPublic),
      shareCode: typeof persistedBoard?.shareCode === "string" ? persistedBoard.shareCode : board.shareCode,
      updatedAt: typeof persistedBoard?.updatedAt === "string" ? persistedBoard.updatedAt : board.updatedAt,
      lastOpenedAt: typeof persistedBoard?.lastOpenedAt === "string" ? persistedBoard.lastOpenedAt : board.lastOpenedAt,
      canEdit: persistedBoard?.canEdit ?? board.canEdit,
    };
  });
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
