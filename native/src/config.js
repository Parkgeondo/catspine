// Ranking backend base URL.
//
// Leave empty ('') to run in LOCAL mode — scores are saved per-device with
// AsyncStorage and no network is used. This is the default so the app works
// out of the box with no server.
//
// To use the online leaderboard, deploy the `server/` from the web project to
// a host (Render, Railway, Fly.io, a VPS…) and put its public URL here, e.g.:
//   export const API_BASE = 'https://cat-spin.up.railway.app';
// Make sure the server's CORS allows the app's requests.
export const API_BASE = '';
