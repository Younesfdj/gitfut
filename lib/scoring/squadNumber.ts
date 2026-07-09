import type { Position } from "./types";

export function generateSquadNumber(login: string, position: Position): number {
    //Create a hash from the username
    let hash = 0;
    for (let i = 0; i < login.length; i++) {
        hash = login.charCodeAt(i) + ((hash << 5) - hash);
    }

    hash = Math.abs(hash);


    return hash;
}