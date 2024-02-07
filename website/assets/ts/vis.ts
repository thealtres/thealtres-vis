import { get } from "jquery";
import { Character, CharacterData, Play, PlayData, Author, AuthorData } from "./IEntity";

var charData: CharacterData, playData: PlayData, authorData: AuthorData;
let charFilters = {
  gender: "any",
  normalizedProfession: "any",
  socialClass: "any",
};
var filteredData: Character[] = [];

function getJSON(path: string) : Promise<any> {
  /* Used to get JSON data from a file */
  console.time("getJSON")
  return new Promise((resolve, reject) => {
    $.ajax({
      url: path,
      method: "GET",
      dataType: "json",
      success: (data) => {
        resolve(data);
      },
      error: (jqXHR, textStatus, errorThrown) => {
        reject(errorThrown);
      }
    });
    console.timeEnd("getJSON");
  });
};

// is Character[] when data is filtered
function generateCharacterTemplate(data: CharacterData | Character[]): string {
  let html = "<ul>";
  $.each(data, function (index, character: Character) {
    html += `<li>${character.persName}</li>`;
  });
  html += "</ul>";

  return html;
}

async function generatePlayTemplate(data: PlayData): Promise<string> {
  console.time("generatePlayTemplate")
  let html = "";
  try {
    // We define getPlayInfo() as async so that we can load data
    // which is not related to characters nor plays (e.g. authors, publishers)
    // while still doing other work in parallel.
    // playPromises is an array of promises, each of which resolves to a string
    // containing the HTML for a single play card.
    // ? check performance
    // ----------------
    // We need to use Object.values() because data is an object, not an array.
    const playPromises = Object.values(data).map(async (play: Play) => {
      const titleMain = play.titleMain;
      const titleSub = play.titleSub;
      const authorId = play.authorId;
      //console.log(titleMain, titleSub, authorId)
      const authorName = await getPlayInfo(authorId, "author");
      //const publisher = getPlayInfo(play["publisher"], "publisher");
      return `<div class='play-card'><p>${titleMain}<br>${authorName}</p></div>`;
    });

    // We need to wait for all promises to resolve before we can return the HTML.
    // Otherwise, the function will return before the promises resolve,
    // and [object Promise] will be returned instead.
    const playHtmlArray = await Promise.all(playPromises);
    html = playHtmlArray.join(''); // Combine HTML strings into a single string
    console.timeEnd("generatePlayTemplate");

    return html;
  } catch (error) {
    console.error("Error generating play template:", error);
    return "";
  }
}

async function getTemplate(data: CharacterData | PlayData, type: string): Promise<string> {
  console.time("getTemplate")
  if (type === "characters") {
    console.timeEnd("getTemplate");
    return generateCharacterTemplate(data as CharacterData);
  } else if (type === "plays") {
    console.timeEnd("getTemplate");
    return generatePlayTemplate(data as PlayData);
  }

  return "";
}

function calcPageSize() {
  const width = $(window).width();

  console.log("Width: " + width);

  //todo: find a better way of dealing with this
  if (width < 768) {
    return 12;
  } else if (width < 992) {
    return 18;
  } else {
    return 15;
  }
};

function getGridElements(type: string) : string[] {
  switch (type) {
    case "characters":
      return ["#char-list-pagination", "#char-list"];
    case "plays":
      return ["#play-list-pagination", "#play-list"];
  }
};

function setPagination(dataSource: any, type: string) : void {
  console.time("setPagination")
  let listOfEls = getGridElements(type);
  // @ts-ignore
  $(listOfEls[0]).pagination({
    dataSource: dataSource,
    pageSize: calcPageSize(),
    showGoInput: true,
    formatGoInput: "go to <%= input %>",
    // The callback needs to be async
    // because we need to wait for the template to be generated
    callback: async (data: CharacterData | PlayData, pagination) => {
      try {
        var html = await getTemplate(data, type);
        $(listOfEls[1]).html(html);
        console.timeEnd("setPagination");
      } catch (error) {
        console.error(error);
      }
    },
  });
}

async function getPlayInfo(id: string | string[], type: string) : Promise<string> {
  console.time("getPlayInfo")
  if (id === undefined) {
    return "Unknown";
  }

  switch (type) {
    case "publisher":
      return;

    case "author":
      const data = authorData;

      try {
        if (typeof id === "string") {
          console.timeEnd("getPlayInfo");
          return data.id.fullName;
        } else if (id instanceof Array) {
          const authorNames = id.map((authorId: string) =>
          data[authorId].fullName);

          console.timeEnd("getPlayInfo");
          return authorNames.join(", ");
        }
      } catch (error) {
        console.error("Error getting play info:", error);
      }
  }
}

function filterCharacters(charData: CharacterData) : Character[] {
  console.time("filterCharacters");
  const genderFilter = charFilters.gender;
  const professionFilter = charFilters.normalizedProfession;
  const socialClassFilter = charFilters.socialClass;

  console.log(genderFilter, professionFilter, socialClassFilter)

  console.log("before : ", Object.values(charData).length)

  const filteredData = Object.values(charData).filter((char: Character) => {
    const genderMatches =
    genderFilter === "any" ||
      // Map "B", "U" and null to "O" (other) to match HTML filter button values
      //? B = ??? (both?)
      //? U = ??? (unknown?) | if unknown, replace nulls w/ script
      (genderFilter === "O" && ["B", "U", null].includes(char.sex)) ||
      char.sex === genderFilter;

    const professionMatches =
      professionFilter === "any" ||
      char.normalizedProfession === professionFilter;

    const socialClassMatches =
      socialClassFilter === "any" ||
      char.socialClass === socialClassFilter;

    return genderMatches && professionMatches && socialClassMatches;
  });

  console.log("after : ", filteredData.length)

  console.timeEnd("filterCharacters");
  return filteredData;
};


// function filterCharacters(charData: Character[], filter) : Character[] {
//   console.time("filterCharacters");

//   const filteredData = charData.filter((char: Character) => {
//     if (filter === "gender") {
//       console.log("filtering gender")
//       return char.sex === charFilters.gender;
//     } else if (filter === "profession") {
//       console.log("filtering profession")
//       return char.profession === charFilters.profession;
//     }
//   });

//   console.timeEnd("filterCharacters");
//   return filteredData;
// };

//todo: unify w/ plays
function updateFilters() {
  const filteredData = filterCharacters(charData);
  const charTemplate = generateCharacterTemplate(filteredData);
  $("#char-list").html(charTemplate);
  setPagination(filteredData, "characters");
}

function showPlaysByCharacter() {
  //todo
  const currentChars: Array<Character> =
  // @ts-ignore
  $("#char-list-pagination").pagination("getCurrentPageData");
}

async function fetchData(): Promise<void> {
  console.time("fetchData");
  try {
    const JSONFiles = ["/json/char_data.json", "/json/play_data.json", "/json/author_data.json"];
    const types = ["characters", "plays", "authors"];

    $("#loader").show();

    [charData, playData, authorData] = await Promise.all(JSONFiles.map((file: string) =>
    // initialization with nested data
    // not sure if really good that way though
    getJSON(file).then(data => data.characters || data.plays || data.authors)));

    const charTemplate = await getTemplate(charData, types[0]);
    const playTemplate = await getTemplate(playData, types[1]);

    $("#char-list").html(charTemplate);
    $("#play-list").html(playTemplate);

    setPagination(charData, types[0]);
    setPagination(playData, types[1]);

    filteredData = Object.values(charData);
  } catch (error) {
    console.error("Error fetching data:", error);
  } finally {
    $("#loader").hide();
  }
  console.timeEnd("fetchData");
}

$(function () {
  fetchData();

  // todo
  // @ts-ignore
  new TomSelect("#select-prof", {
    create: true,
    sortField: {
      field: "text",
      direction: "asc"
      }
    });

  // $("input[name=gender]").on("change", function () {
  //   charFilters.gender = $(this).val();

  //   console.log("aa", filteredData)
  //   if (!isGenderFiltered) {
  //     filteredData = filterCharacters(filteredData, "gender");
  //     isGenderFiltered = true;
  //   } else {
  //     filteredData = filterCharacters(Object.values(charData), "gender");
  //     isGenderFiltered = false;
  //   }
  //   console.log("bb", filteredData)
  //   const charTemplate = generateCharacterTemplate(filteredData);
  //   $("#char-list").html(charTemplate);
  //   setPagination(filteredData, "characters");
  // });

  $("input[name=gender]").on("change", function () {
    charFilters.gender = <string>$(this).val();
    updateFilters();
  });

  $("input[name=profession]").on("change", function () {
    charFilters.normalizedProfession = <string>$(this).val();
    updateFilters();
  });

  $("input[name=class]").on("change", function () {
    charFilters.socialClass = <string>$(this).val();
    updateFilters();
  });

  // $("input[name=profession]").on("change", function () {
  //   charFilters.profession = $(this).val();

  //   filteredData = filterCharacters(filteredData, "profession");
  //   const charTemplate = generateCharacterTemplate(filteredData);
  //   $("#char-list").html(charTemplate);
  //   setPagination(filteredData, "characters");
  // });

  // this is not a so good idea, we'll think more about that later
  //$(window).on("resize", fetchData);
});