interface Character {
    persName: string;
    //todo
}

interface Play {
    titleMain: string;
    titleSub: string;
    authorId: string | string[];
    nbActs: string;
}

export {
    Character,
    Play
}