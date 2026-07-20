import type { Position } from "./types";

export function generateSquadNumber(login: string, position: Position, overall: number): number {
    //Create a hash from the username
    let hash = 0;
    for (let i = 0; i < login.length; i++) {
        hash = login.charCodeAt(i) + ((hash << 5) - hash);
    }

    hash = Math.abs(hash);

    //Iconic squad numbers grouped by football positions
    const posNumbers: Record<Position, number[]> = {
        ST: [7, 9, 10, 11, 19, 22, 18, 20, 14, 45, 99],
        RW: [7, 10, 11, 17, 22, 21, 20, 23, 18, 10, 19],
        CAM: [10, 8, 11, 20, 22, 18, 23, 42],
        CM: [8, 6, 14, 16, 17, 22, 16, 15, 19, 20, 88],
        CDM: [6, 4, 15, 16, 14, 28, 23, 8, 18, 25, 5],
        CB: [4, 5, 2, 3, 6, 12, 15, 26, 33],
    };

    const pool = posNumbers[position]||[7, 9, 10, 11];

    //Elite players (90+ OVR) always get the classic #1 choice for their position
    if(overall >= 90){
        return pool[0];
    }
    
    //Else use the hash to pick a varied, but consistent number
    return pool[hash % pool.length];
}