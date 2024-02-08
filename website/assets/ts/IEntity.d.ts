interface Character {
    workId: number;
    lang: string;
    characterId: number;
    persName: string;
    sex: string;
    normalizedProfession: string;
    socialClass: string;
}

interface Play {
    workId: number;
    lang: string;
    titleMain: string;
    titleSub: string;
    authorId: string | string[];
    publisherId: string;
    nbActs: string;
    characters: Character[]; // not part of the JSON; used for showPlaysByCharacters()
}

interface Author {
    fullName: string;
}

interface Location {
    placeId: number;
    lang: string;
    name: string;
    OSMLatLon: string;
    nature: string;
}

interface Publisher {
    publisherId: number;
    lang: string;
    normalizedName: string;
    coord: string;
}

interface Setting {
    workId: number;
    lang: string;
    actId: number;
    sceneId: number;
    placeId: string[]; //?
    coord: string;
}

export {
    Character,
    Play,
    Author,
    Location,
    Publisher,
    Setting
}