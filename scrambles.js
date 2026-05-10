import { randomScrambleForEvent } from "https://cdn.cubing.net/v0/js/cubing/scramble";

export async function getScramble() {
    const scramble = await randomScrambleForEvent("333bf"); 
    return scramble.toString();
}