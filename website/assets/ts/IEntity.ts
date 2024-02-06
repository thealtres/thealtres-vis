interface Character {
    persName: string;
    sex: string;
}

interface CharacterData {
    [key: string]: Character;
}

interface Play {
    titleMain: string;
    titleSub: string;
    authorId: string | string[];
    nbActs: string;
}

interface PlayData {
    [key: string]: Play;
}

interface Author {
    fullName: string;
}

interface AuthorData {
    [key: string]: Author;
}

export {
    Character,
    CharacterData,
    Play,
    PlayData,
    Author,
    AuthorData
}