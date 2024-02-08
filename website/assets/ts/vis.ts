import { get } from "jquery";
import { Character, Play, Author } from "./IEntity";

const filterInputs = $("input[name=gender], input[name=normalizedProfession], input[name=socialClass], input[name=lang]");

var charData: Character[], playData: Play[], authorData: Author[];
var filteredCharData: Character[] = [], filteredPlayData: Play[] = [];

let defaultCharFilters = {
  gender: "any",
  normalizedProfession: "any",
  socialClass: "any",
  lang: "any",
};
let charFilters = {...defaultCharFilters};

let defaultPlayFilters = {
  publisher: "any",
  author: "any",
  lang: "any",
};
let playFilters = {...defaultPlayFilters};

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

function generateCharacterTemplate(data: Character[]): string {
  let html = "<ul class='char'>";
  $.each(data, function (index, character: Character) {
    html += `<li>${character.persName}</li>`;
  });
  html += "</ul>";

  return html;
};

async function generatePlayTemplate(data: Play[], showChars = false): Promise<string> {
  console.time("generatePlayTemplate")
  let html = "";
  try {
    // We define getPlayInfo() as async so that we can load data
    // which is not related to characters nor plays (e.g. authors, publishers)
    // while still doing other work in parallel.
    // playPromises is an array of promises, each of which resolves to a string
    // containing the HTML for a single play card.
    // ? check performance
    console.log("generatePlayTemplatedata", data)
    const playPromises = data.map(async (play: Play) => {
      const titleMain = play.titleMain;
      const titleSub = play.titleSub;
      const authorId = play.authorId;
      const authorName = await getPlayInfo(authorId, "author");
      //const publisher = getPlayInfo(play["publisher"], "publisher");
      html = `<p>${titleMain}<br>${authorName}</p>`

      if (showChars) {
        html += generateCharacterTemplate(play.characters);
      }

      return `<div class="play-card">${html}</div>`
    });

    // We need to wait for all promises to resolve before we can return the HTML.
    // Otherwise, the function will return before the promises resolve,
    // and [object Promise] will be returned instead.
    const playHtmlArray = await Promise.all(playPromises);
    html = playHtmlArray.join(""); // Combine HTML strings into a single string
    console.timeEnd("generatePlayTemplate");

    return html;
  } catch (error) {
    console.error("Error generating play template:", error);
    return "";
  }
}

async function getTemplate(data: Character[] | Play[], type: string): Promise<string> {
  console.time("getTemplate")
  if (type === "characters") {
    console.timeEnd("getTemplate");
    return generateCharacterTemplate(data as Character[]);
  } else if (type === "plays") {
    console.timeEnd("getTemplate");
    return generatePlayTemplate(data as Play[]);
  }

  return "";
};

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
    callback: async (data: Character[] | Play[], pagination) => {
      try {
        var html = await getTemplate(data, type);
        $(listOfEls[1]).html(html);
        console.timeEnd("setPagination");
      } catch (error) {
        console.error(error);
      }
    },
  });
};

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
          return data["id"].fullName;
        } else if (id instanceof Array) {
          // authorId can be an array if there are several authors for one play
          // so we map over it and retrieve the full name of each author
          const authorNames = id.map((authorId: string) =>
          data[authorId].fullName);

          console.timeEnd("getPlayInfo");
          return authorNames.join(", ");
        }
      } catch (error) {
        console.error("Error getting play info:", error);
      };
  };
};

function filterCharacters(charData: Character[]) : Character[] {
  console.time("filterCharacters");
  //possible values: M, F, B, U
  const genderFilter = charFilters.gender;

  const professionFilter = charFilters.normalizedProfession;

  //possible values: UC, MC, UMC, LC, LMC, LMC|UC
  //? what is LMC|UC?
  const socialClassFilter = charFilters.socialClass;
  //possible values: fre, ger, als
  const langFilter = charFilters.lang;

  console.log(genderFilter, professionFilter, socialClassFilter, langFilter)

  console.log("before : ", charData.length)

  filteredCharData = charData.filter((char: Character) => {
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

      const langMatches =
      langFilter === "any" ||
      char.lang === langFilter;

    return genderMatches && professionMatches && socialClassMatches && langMatches;
  });

  console.log("after : ", filteredCharData.length)

  // activate "Show Plays" filter button
  // we only want to enable the button if the list is filtered
  // since all plays are shown by default
  $("#char-list-show-plays-btn").prop("disabled", false);

  console.timeEnd("filterCharacters");
  return filteredCharData;
};

//todo: unify w/ plays
function updateFilters() {
  const filteredData = filterCharacters(charData);
  const charTemplate = generateCharacterTemplate(filteredData);
  $("#char-list").html(charTemplate);
  setPagination(filteredData, "characters");
};

function resetFilters() {
  filterInputs.each((index, e) => {
    if ($(e).val() === "any") {
      $(e).prop("checked", true);
    }
  });

  //todo: make default char template
  const charTemplate = generateCharacterTemplate(charData);
  $("#char-list").html(charTemplate);

  charFilters = defaultCharFilters;
  $("#char-list-show-plays-btn, #filter-reset-btn").prop("disabled", true);
};

async function showPlaysByCharacters() : Promise<void> {
  const playsWithChars: Play[] = [];

  filteredCharData.forEach((char: Character) => {
    playData.filter((play: Play) => play.workId === char.workId && play.lang === char.lang)
    .forEach((play: Play) => {
      // check if play already exists in playsWithChars
      // if so, we only need to update the characters array, not the entire object
      // otherwise, this creates duplicates and will show one play per character
      // even though some characters share the same play
      let playMatch = playsWithChars.find(p =>
        p.workId === play.workId && p.lang === play.lang
      );

      if (playMatch) {
        playMatch.characters.push(char);
      } else {
        playsWithChars.push({
          ...play,
          characters: [char]
        });
      }
    });
  });

  console.log("playsWithChars", playsWithChars)

  const playTemplate = await generatePlayTemplate(playsWithChars, true);
  $("#play-list").html(playTemplate);
  $(".play-header").text("Plays (filtered by character)");
  console.log("playTemplate", playTemplate)
  //?todo: fix bug with pagination
  //?todo: not updating html template properly probably due to async
  //setPagination(playsWithChars, "plays");
};

async function fetchData(): Promise<void> {
  console.time("fetchData");
  try {
    const JSONFiles = ["/json/char_data.json", "/json/play_data.json", "/json/author_data.json"];
    const types = ["characters", "plays", "authors"];

    $("#loader").show();

    [charData, playData, authorData] = await Promise.all(
      JSONFiles.map(async (file: string) => {
        const {characters, plays, authors} = await getJSON(file);
        return characters || plays || authors;
      })
    );

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
};

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

  // "this" is an input element, not an HTMLElement
  // TS fix: https://www.typescriptlang.org/docs/handbook/2/functions.html#declaring-this-in-a-function
  filterInputs.on("change", function(this: HTMLInputElement) {
    if ($("#filter-reset-btn").prop("disabled")) {
      $("#filter-reset-btn").prop("disabled", false);
    }

    const filterName = this.name;
    charFilters[filterName] = $(this).val();
    updateFilters();
  });

  //?only show button if filter applied
  $("#char-list-show-plays-btn").on("click", showPlaysByCharacters);

  $("#filter-reset-btn").on("click", resetFilters);

  // this is not a so good idea, we'll think more about that later
  //$(window).on("resize", fetchData);
});