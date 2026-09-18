const KEY = "my_team_id";

/** Remembers which team this browser belongs to (set once at participant
 * check-in), so a forced audience-navigation broadcast knows to skip it. */
export function rememberMyTeam(teamId: string) {
  try {
    localStorage.setItem(KEY, teamId);
  } catch {
    /* private browsing / storage blocked — the broadcast just won't exclude this browser */
  }
}

export function getMyTeamId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
