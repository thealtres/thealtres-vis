import { get } from "jquery";
import { Character, CharacterData, Play, PlayData, Author, AuthorData } from "./IEntity";

var charData: CharacterData, playData: PlayData, authorData: AuthorData;

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
  var html = "<ul>";
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
  var listOfEls = getGridElements(type);
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
  const genderFilter = $("input[name=gender]:checked").val()

  const filteredData = Object.values(charData).filter((char: Character) => {
    return char.sex === genderFilter;
  });

  console.timeEnd("filterCharacters");
  return filteredData;
};

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
  } catch (error) {
    console.error("Error fetching data:", error);
  } finally {
    $("#loader").hide();
  }
  console.timeEnd("fetchData");
}

$(function () {
  fetchData();

  $("input[name=gender]").on("change", function () {
    const filteredData = filterCharacters(charData);
    const charTemplate = generateCharacterTemplate(filteredData);
    $("#char-list").html(charTemplate);
    setPagination(filteredData, "characters");
  });

  // this is not a so good idea, we'll think more about that later
  //$(window).on("resize", fetchData);
});
