import { Character, Play, Author, Publisher } from "./IEntity";
import { setTimeline } from "../js-plugins/d3-timeline";

const filterInputs = $("input[name=gender], input[name=normalizedProfession], input[name=socialClass], input[name=lang]");

let charData: Character[] = [], playData: Play[] = [],
authorData: Author[] = [], publisherData: Publisher[] = [];

let filteredCharData: Character[] = [], filteredPlayData: Play[] = [];

const defaultCharFilters = {
  gender: "any",
  normalizedProfession: "any",
  socialClass: "any",
  lang: "any",
};
let charFilters = {...defaultCharFilters};

const defaultPlayFilters = {
  publisher: "any",
  author: "any",
  lang: "any",
};
let playFilters = {...defaultPlayFilters};

let scrollProgressChar = 0;
let totalShownCharItems = 0;

let totalShownCharItems, totalShownPlayItems = 0;
// multiplier for totalShownItems in handleScroll(); used only for play cards
let cardsPerRow = 1;
let preventScrollEvent = false;

var td;

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

function handleScroll(e, isScrollPrevented: boolean) {
  if (isScrollPrevented) {
    return;
  }
  preventScrollEvent = false;

  const elName = e.className.split(" ")[1];
  const listHeight = elName === "main-view-chars" ? $("#char-list").height() :
   getPlayListHeight();
  const relatedEls = {
    "main-view-chars": [["#char-list", ".char-progress"], totalShownCharItems],
    "main-view-plays-table": [["#play-list", ".play-progress"], totalShownPlayItems]
  }

  const containerHeight = $("#vis-container").height();
  const totalShownItems = relatedEls[elName][1];

  //todo: fix for play cards; count is not correct
  let scrollProgress = e.scrollTop / (listHeight - containerHeight) * (totalShownItems * cardsPerRow);

  // fix going beyond the total number of items
  scrollProgress = Math.round(Math.max(0, Math.min(totalShownItems * cardsPerRow, scrollProgress)));

  const progressEl = relatedEls[elName][0][1];

  if (scrollProgress === 0) {
    $(progressEl).text(`${totalShownItems}`);
  } else {
    $(progressEl).text(`${scrollProgress}/${totalShownItems}`);
  }
}

function getPlayListHeight() {
  let playListHeight = 0;

  $("#play-list").find(".play-card").each((index, el) => {
    playListHeight += $(el).outerHeight();
  });

  return playListHeight;
}

function setCardsPerRow() {
  const cardWidth = $('.play-card:first-child').width();
  const containerWidth = $('#play-list').width();
  const cards = Math.floor(containerWidth / cardWidth);

  cardsPerRow = cards;
}

function generateTimelineData(data: Play[]) {
  const yearsCount = [];

  data.forEach((p: Play) => {
    // developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unary_plus
    const year = +p.printed;

    if (!isNaN(year) && year !== 0) {
      const existingYear = yearsCount.find((item) => item.year === year);

      if (existingYear) {
        existingYear.count++;
      } else {
        yearsCount.push({ count: 1, year });
      }
    }
  });

  // convert to string for D3
  yearsCount.forEach(item => {
    item.year = item.year.toString();
  });

  return yearsCount;
};

    // strings will be converted to 0 by previously-defined unary plus
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unary_plus

function fillSelect(dataType: string, selectId: string) {
  // string for profession, number for ids (author, publisher)
  let data: { value: string | number, text: string }[];

  switch (dataType) {
    case "profession":
      data = charData.map((char: Character) => ({
        value: char.normalizedProfession,
        text: char.normalizedProfession,
      }));
      break;
    case "publisher":
      data = publisherData.map((publisher: Publisher) => ({
        value: publisher.publisherId,
        text: publisher.normalizedName,
      }));
      break;
    case "author":
      data = authorData.map((author: Author) => ({
        value: author.authorId,
        text: author.fullName,
      }));
      break;
  }

  // @ts-ignore
  new TomSelect(selectId, {
    options: data,
    plugins: ["remove_button"],
    sortField: {
      field: "text",
      direction: "asc"
    },
    maxOptions: 5,
    highlight: true,
    maxItems: null,
  });
};

function generateCharacterTemplate(data: Character[]): string {
  let html = "<ul class='char'>";
  $.each(data, async function (index, character: Character) {
    let name = character.persName ?? "";
    let sex = character.sex ?? "";
    let socialClass = character.socialClass ?? "";
    let profession = character.normalizedProfession ?? "";
    //let date = await getPlayInfo(character.workId, character.lang, "premiered") ?? "";

    // filter out empty values
    let charText = [name, sex, socialClass, profession].filter(Boolean).join(", ");

    html += `<li>${charText}</li>`;
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
      const lang = play.lang;
      const authorId = play.authorId;
      const authorName = await getPlayInfo(authorId, lang, "author");
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

function getGridElements(type: string) : string[] {
  switch (type) {
    case "characters":
      return ["#char-list-pagination", "#char-list"];
    case "plays":
      return ["#play-list-pagination", "#play-list"];
  }
};

async function getPlayInfo(id: number | number[], lang: string, type: string) : Promise<string|number> {
  console.time("getPlayInfo")
  if (id === undefined) {
    return "Unknown";
  }

  switch (type) {
    case "publisher":
      console.log("publisherData", publisherData)
      //console.log("publisherData[id]", publisherData[id as number].nameOnPlay)
      return "";

    case "author":
      try {
        if (typeof id === "number") {
          console.timeEnd("getPlayInfo");
          const authorName = authorData.find((author: Author) =>
          author.authorId === id && author.lang === lang).fullName;
          return authorName;
        } else if (id instanceof Array) {
          // authorId can be an array if there are several authors for one play
          // so we map over it and retrieve the full name of each author
          const authorNames = id.map((authorId: number) =>
            authorData.find((author: Author) =>
              author.authorId === authorId && author.lang === lang).fullName
          );

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
  totalShownCharItems = filteredCharData.length;

  console.timeEnd("filterCharacters");
  return filteredCharData;
};

function filterPlays(playData: Play[]) : Play[] {
  console.time("filterPlays");
  const publisherFilter = playFilters.publisher;
  const authorFilter = playFilters.author;
  const langFilter = playFilters.lang;

  filteredPlayData = playData.filter((play: Play) => {
    const publisherMatches =
      publisherFilter === "any" ||
      play.publisherId === publisherFilter;

    const authorMatches =
      authorFilter === "any" ||
      //todo: fix
      play.authorId === authorFilter;

    const langMatches =
      langFilter === "any" ||
      play.lang === langFilter;

    return publisherMatches && authorMatches && langMatches;
  });

  // activate "Show Characters" filter button
  // we only want to enable the button if the list is filtered
  // since all characters are shown by default
  $("#play-list-show-chars-btn").prop("disabled", false);

  totalShownPlayItems = filteredPlayData.length;

  console.timeEnd("filterPlays");
  return filteredPlayData;
}

async function updateFilters(dataType: string) {
  let filteredData: Character[] | Play[], template: string | Promise<string>;
  switch (dataType) {
    case "characters":
      filteredData = filterCharacters(charData);
      template = generateCharacterTemplate(filteredData);
      $("#char-list").html(template);
    case "plays":
      filteredData = filterPlays(playData)
      template = await generatePlayTemplate(filteredData);
      $("#play-list").html(template);
  }


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
  $("#char-list-show-plays-btn, #play-list-show-chars-btn, #filter-reset-btn")
  .prop("disabled", true);
};

function updateProgress() {
  console.log("scrollProgressChar", scrollProgressChar, "totalShownCharItems", totalShownCharItems)
  if (scrollProgressChar > 0) {
    preventScrollEvent = true;
    $(".main-view-chars").scrollTop(0);
  }
  $(".char-progress").text(`${totalShownCharItems}`);
}

async function showRelations(viewMode: string) : Promise<void> {
  console.time("showRelations");
  if (viewMode === "playsByChar") {
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
    const playTemplate = await generatePlayTemplate(playsWithChars, true);
    $("#play-list").html(playTemplate);
    $(".play-header").text("Plays (filtered by character)");
  } else if (viewMode === "charsByPlay") {
    const charsInPlays: Character[] = [];

    filteredPlayData.forEach((play: Play) => {
      charData.filter((char: Character) => char.workId === play.workId && char.lang === play.lang)
      .forEach((char: Character) => {
        charsInPlays.push(char);
      });
    });
    const charTemplate = generateCharacterTemplate(charsInPlays);
    $("#char-list").html(charTemplate);
  }
  console.timeEnd("showRelations");
};

async function fetchData(): Promise<void> {
  console.time("fetchData");
  try {
    const JSONFiles = ["/json/char_data.json", "/json/play_data.json",
                      "/json/author_data.json", "/json/publisher_data.json"];

    $("#loader").show();

    [charData, playData, authorData, publisherData] = await Promise.all(
      JSONFiles.map(async (file: string) => {
        const {characters, plays, authors, publishers} = await getJSON(file);
        return characters || plays || authors || publishers;
      })
    );
  } catch (error) {
    console.error("Error fetching data:", error);
  } finally {
    drawUI();
    $("#loader").hide();
  }
  console.timeEnd("fetchData");
};

async function drawUI() {
  console.log(playData, charData, authorData, publisherData)
  const charTemplate = await getTemplate(charData, "characters");
  const playTemplate = await getTemplate(playData, "plays");

  $("#char-list").html(charTemplate);
  $("#play-list").html(playTemplate);

  fillSelect("profession", "#select-prof");
  fillSelect("publisher", "#select-pub");
  fillSelect("author", "#select-author");

  td = generateTimelineData(playData)
  setTimeline(td)

  totalShownCharItems = charData.length;
  totalShownPlayItems = playData.length;
  $(".char-progress").text(`${totalShownCharItems}`);
  $(".play-progress").text(`${totalShownPlayItems}`);

  setCardsPerRow();
}

$(function () {
  fetchData();

  console.log("filteredData", filteredPlayData)

  // "this" is an input element, not an HTMLElement
  // TS fix: https://www.typescriptlang.org/docs/handbook/2/functions.html#declaring-this-in-a-function
  //todo: create filterInputs dict with separate inputs for char and plays
  filterInputs.on("change", function(this: HTMLInputElement) {
    if ($("#filter-reset-btn").prop("disabled")) {
      $("#filter-reset-btn").prop("disabled", false);
    }

    //scrollProgressChar = 0;

    const filterName = this.name;
    charFilters[filterName] = $(this).val();
    //todo: change this so that it accepts plays as well
    updateFilters("characters");
    //todo: remove; testing array only
    updateFilters("plays")
    console.log("playData", filteredPlayData)
    updateProgress();
  });

  $("#char-list-show-plays-btn").on("click", function() {
    showRelations("playsByChar");
  });

  $("#play-list-show-chars-btn").on("click", function() {
    showRelations("charsByPlay");
  });

  $("#filter-reset-btn").on("click" , function() {
    resetFilters();
    updateProgress();
  });

  $(".main-view-chars, .main-view-plays-table").on("scroll", function() {
    handleScroll(this, preventScrollEvent);
  });

  //setTimeline(filteredPlayData)
});