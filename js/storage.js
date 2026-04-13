import { openDB as idbOpenDB } from 'https://cdn.jsdelivr.net/npm/idb@8/build/index.js';

const DB_NAME = 'padelapp-db';
const DB_VERSION = 1;
const STORE_NAME = 'tournaments';
const ACTIVE_KEY = 'padelapp-active-tournament';
const THEME_KEY = 'padelapp-theme';

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = idbOpenDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    });
  }
  return dbPromise;
}

// ===== localStorage (synchronous) =====

export function saveActiveTournament(tournament) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(tournament));
}

export function loadActiveTournament() {
  try {
    const data = localStorage.getItem(ACTIVE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function clearActiveTournament() {
  localStorage.removeItem(ACTIVE_KEY);
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

export function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

// ===== IndexedDB (async) =====

export async function saveTournamentHistory(tournament) {
  const db = await getDB();
  await db.put(STORE_NAME, tournament);
}

export async function getAllTournamentHistory() {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteTournamentHistory(id) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function getTournamentById(id) {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}
