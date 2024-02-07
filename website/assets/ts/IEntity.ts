interface Character {
    lang: string;
    characterId: number;
    persName: string;
    sex: string;
    normalizedProfession: string;
    socialClass: string;
}

interface CharacterData {
    [key: string]: Character;
}

interface Play {
    titleMain: string;
    titleSub: string;
    authorId: string | string[];
    publisherId: string;
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

interface Location {
    placeId: number;
    lang: string;
    name: string;
    OSMLatLon: string;
    nature: string;
}

interface LocationData {
    [key: string]: Location;
}

interface Publisher {
    publisherId: number;
    lang: string;
    normalizedName: string;
    coord: string;
}

interface PublisherData {
    [key: string]: Publisher;
}

interface Setting {
    workId: number;
    lang: string;
    actId: number;
    sceneId: number;
    placeId: string[]; //?
    coord: string;
}

interface SettingData {
    [key: string]: Setting;
}

export {
    Character,
    CharacterData,
    Play,
    PlayData,
    Author,
    AuthorData,
    Location,
    LocationData,
    Publisher,
    PublisherData,
    Setting,
    SettingData
}