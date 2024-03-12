interface Character {
    workId: number;
    lang: string;
    characterId: number;
    persName: string;
    sex: string;
    normalizedProfession: string;
    professionalGroup: string;
    socialClass: string;
    play: Play; // not part of the JSON; used for showRelations()
}

interface Play {
    workId: number;
    lang: string;
    titleMain: string;
    titleSub: string;
    authorId: number | number[];
    publisherId: string;
    nbActs: string;
    printed: string; // some values such as: "?1824"
    genre: string;
    subgenre: string;
    characters: Character[]; // not part of the JSON; used for showRelations()
}

interface Author {
    authorId: number;
    lang: string;
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
    nameOnPlay: string;
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