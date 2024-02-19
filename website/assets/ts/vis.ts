import { Character, Play, Author, Publisher } from "./IEntity";
import { setTimeline, highlightGraphPeriod, clearGraphHighlight } from "../js-plugins/d3-timeline";

// These are professionalGroup values to be filtered out in fillFilterValues()
// we may convert them to null in the future
const invalidProfValues = ["n/a", "ignorer", "vague", "pas couvert", "unknown"]

const charFilterEls = {
  "lang": $("#filter-lang-values"),
  "sex": $("#filter-gender-values"),
  "professionalGroup": $("#filter-profession-values"),
  "socialClass": $("#filter-social-class-values"),
}

let charData: Character[] = [], playData: Play[] = [],
authorData: Author[] = [], publisherData: Publisher[] = [];

let filteredCharData: Character[] = [], filteredPlayData: Play[] = [];

const defaultCharFilters = {
  lang: [],
  sex: [],
  professionalGroup: [],
  socialClass: [],
};
let charFilters = {...defaultCharFilters};

const defaultPlayFilters = {
  publisher: [],
  author: [],
  lang: [],
};
let playFilters = {...defaultPlayFilters};

let currentCharTemplate: string, currentPlayTemplate: string;

let totalShownCharItems = 0, totalShownPlayItems = 0;

let preventScrollEvent = false;

let timelineData = [];

/* Pagination */
let playCurrentPage = 1;
let charCurrentPage = 1;
const itemsPerPage = 50;
let loadedCharData = [];
let loadedPlayData = [];

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

/**
 * Returns a year range from the data
 * @param data - array of plays
 * @returns - array of years
 */
function getDataYears(data: Play[]) : number[] {
  // we're using plays to get years of the data
  // because it has the "printed" property
  const years = data.map((item: Play) => +item.printed);
  // filter duplicates
  return years.filter((year, index) => years.indexOf(year) === index && year !== 0);
}

function findSuccessiveYears(years: number[]) : object {
  const sortedDates = years.sort((a, b) => a - b);
  const ranges = {}; // { range1: [1824, 1825, 1826], range2: [1830, 1831] }
  let currentRange = [];

  console.log("sortedDates", sortedDates)

  for (let i = 0; i < sortedDates.length; i++) {
    const currentDate = sortedDates[i];

    if (i === 0 || currentDate !== sortedDates[i - 1] + 1) {
      if (currentRange.length > 0) {
        // check if range has only one date
        // we need one beginning and one end date to create the highlight rect
        if (currentRange.length === 1) {
          console.log("currentRange", currentRange)
          currentRange.push(currentRange[0] + 1);
        }
        ranges[`range${Object.keys(ranges).length + 1}`] = currentRange;
      }
      currentRange = [currentDate];
    } else {
      currentRange.push(currentDate);
    }
  }

  console.log("currentRange0", currentRange)

  // add last range
  if (currentRange.length > 0) {
    // check if range has only one date
    // we need one beginning and one end date to create the highlight rect
    if (currentRange.length === 1) {
      console.log("currentRange", currentRange)
      currentRange.push(currentRange[0] + 1);
    }
    ranges[`range${Object.keys(ranges).length + 1}`] = currentRange;
  }

  return ranges;
}

async function renderData(elName, loadedData, currentPage, dateRanges = null) {
  if ($("g.context").find("rect.highlight-rect").length > 0
      // only clear if there are dateRanges
      // when rendering the next page, dateRanges is null (because no new data)
      // this caused the highlight to be cleared when scrolling
      // to the next page because rect.length > 0
      && (dateRanges !== null
      && currentPage !== 1)

      // or, clear if play-specific option is unselected
      || (dateRanges === null && currentPage === 1)) {
    clearGraphHighlight();
  }

  console.log(dateRanges)
  console.log(currentPage)

  if (loadedData.length === 0) {
    if (elName === "main-view-chars") {
      $("#char-list").html("<p>No characters found</p>");
      $("#char-list-show-plays-btn, #char-list-sort-btn").addClass("disabled");
    } else {
      $("#play-list").html("<p>No plays found</p>");
      $("#play-list-show-chars-btn, #play-list-sort-btn").addClass("disabled");
    }
    return;
  }

  const pageData = loadedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const template = elName === "main-view-chars" ? generateCharacterTemplate(pageData) :
    await generatePlayTemplate(pageData);

  let html = elName === "main-view-chars" ?
    $("#char-list").html() + `<p id="chars-p-${currentPage}">Page ${currentPage}</p>` + template :
    $("#play-list").html() + `<span id="plays-p-${currentPage}">Page ${currentPage}</span>` + template;

  if (elName === "main-view-chars") {
    $("#char-list").html(html);
  } else {
    $("#play-list").html(html);
  }

  const selectId = elName === "main-view-chars" ?
  "#char-list-pagination" : "#play-list-pagination";
  const option = document.createElement("option");
  option.value = `#${elName.split("-")[2]}-p-${currentPage}`;

  option.innerHTML = `Page ${currentPage}`;
  // append option and change selected option to last loaded page
  $(selectId).append(option).val(option.value);

  if (dateRanges) {
    for (const range in dateRanges) {
      const minYear = dateRanges[range][0];
      const maxYear = dateRanges[range][dateRanges[range].length - 1];
      highlightGraphPeriod(minYear, maxYear);
    }
  }
}

function handlePagination(e, currentPage, totalItems, filteredData, loadedData) {
  const elName = e.className.split(" ")[1];
  let currentScrollPosition = e.scrollTop;
  const listHeight = elName === "main-view-chars" ? $("#char-list").height() :
   getPlayListHeight();
  const viewPortHeight = $(e).height();

  if (currentScrollPosition + viewPortHeight >= listHeight) {
    if (currentPage * itemsPerPage < totalItems) {
      currentPage++;
      console.log("filteredD", filteredData, currentPage, itemsPerPage)
      const newData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
      loadedData.push(...newData);
      console.log(`Loading page ${currentPage} of ${elName} with ${newData.length} items`);
      renderData(elName, loadedData, currentPage);
    }
  }

  if (elName === "main-view-chars") {
    charCurrentPage = currentPage;
  } else {
    playCurrentPage = currentPage;
  }
};

function scrollToPageNumber(pageNumber, type) {
  preventScrollEvent = true;
  const anchor = document.getElementById(`${type}-p-${pageNumber}`);

  if (anchor) {
    anchor.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  } else {
    console.error(`No anchor found for page ${pageNumber}, type ${type}`);
  }
  preventScrollEvent = false;
}

function handleScroll(e, isScrollPrevented: boolean) {
  if (isScrollPrevented) {
    return;
  }
  preventScrollEvent = false;

  const elName = e.className.split(" ")[1];
  if (elName === "main-view-chars") {
    handlePagination(e, charCurrentPage, totalShownCharItems, filteredCharData, loadedCharData);
  } else {
    handlePagination(e, playCurrentPage, totalShownPlayItems, filteredPlayData, loadedPlayData);
  }
}

function getPlayListHeight() {
  const playList = document.getElementById("play-list");
  // used to store the height of every row
  const rowHeights = [];
  let currentRowHeight = 0;

  const containerWidth = playList.offsetWidth;
  // we're using the second child to calculate the width
  // because the first child is the page anchor
  const secondChild = playList.children[1] as HTMLElement;
  const itemWidth = secondChild.offsetWidth;

  // calculate how many items fit on a row
  const itemsPerRow = Math.floor(containerWidth / itemWidth);

  for (const child of <any>playList.children) {
    currentRowHeight += child.offsetHeight;
    // if the row is full, store the height and reset the counter
    if (currentRowHeight > playList.offsetHeight) {
      rowHeights.push(currentRowHeight);
      currentRowHeight = 0;
    }
  }

  // handle the last row (might not fill the full height)
  if (currentRowHeight > 0) {
    rowHeights.push(currentRowHeight);
  }

  return rowHeights.reduce((acc, height) => acc + height, 0) / itemsPerRow;
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

async function fillFilterValues(data) {
  switch (data) {
    case "characters":
      // This JSON file is used to map values in charData to:
      // 1) their full names to be shown as tooltips
      // (applies to lang, gender and socialClass)
      // 2) their abbreviated values to be shown as buttons
      // as the original values would be too long to display
      // (applies to professionalGroup)
      const filterMappings = await getJSON("/json/misc/filter_map.json");
      // Keep an array of original (long) professionalGroup values
      // to later set the og-value attribute of the Profession filter buttons.
      // We set the og-value attribute to the original value
      // because Character's professionalGroup values
      // are not the mapped (abbreviated) ones, but the original ones.
      // Not doing this would make it impossible to filter professions.
      //todo: check what's the diff btwn "intermediate professions"
      //todo: and "intermediate professionals"
      const originalProfValues = [];

      for (const key in charFilterEls) {
        const values = new Set();

        if (key === "professionalGroup") {
          for (const char of charData) {
            const originalValue = char.professionalGroup;

            // skip invalid values
            if (invalidProfValues.includes(originalValue)
            || originalValue === null) continue;

            const mappedValue = filterMappings.professionalGroup[originalValue];
            originalProfValues.push(originalValue);

            if (mappedValue) {
              values.add(mappedValue);
            } else {
              values.add(originalValue);
            }
          };
        } else {
          const newValues = charData.map((char) => char[key])
          .filter(value => value !== null);

          newValues.forEach(value => values.add(value));
        }

        const select = charFilterEls[key];
        values.forEach((value : string) => {
          const option = document.createElement("button");
          option.name = key;
          option.textContent = value;

          // set og-value attribute for profession filter buttons
          // to the original (long) value in order to filter correctly
          if (key === "professionalGroup") {
            const originalValue =
            originalProfValues.find((val) =>
            filterMappings.professionalGroup[val] === value);

            option.dataset.ogValue = originalValue;
            // set title tooltip
            option.title = originalValue;
          } else {
            option.title = filterMappings[key][value];
          }

          $(option).addClass("filter-btn");
          select.append(option);
        });
      }
    case "plays":
      fillSelect("publisher", "#select-pub");
      fillSelect("author", "#select-author");
    }
}

function enableCharFilterBtns() {
  $(".filter-btn").on("click", function() {
    const key = $(this).attr("name");
    let value = null;
    if (key != "professionalGroup") {
      value = $(this).text();
    } else {
      value = $(this).data("og-value");
    }
    console.log(key, value)
    if ($(this).hasClass("active")) {
      $(this).removeClass("active");
      // remove value from array
      charFilters[key] = charFilters[key].filter(item => item !== value);
    } else {
      $(this).addClass("active");
      if (!charFilters[key].includes(value)) {
        charFilters[key].push(value);
      }
    }

    updateFilters("characters");
    updateProgress();
  });
}

function fillSelect(dataType: string, selectId: string) {
  let data: { value: number, text: string }[];

  switch (dataType) {
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
    maxOptions: null,
    highlight: true,
    maxItems: null,
  });
};

function generateCharacterTemplate(data: Character[], showPlayBtn = true): string {
  let html = "<ul class='char'>";
  $.each(data, function (index, character: Character) {
    let workId = character.workId;
    let charId = character.characterId;
    let lang = character.lang;
    let name = character.persName ?? "";
    let sex = character.sex ?? "";
    let socialClass = character.socialClass ?? "";
    let profession = character.professionalGroup ?? "";
    //let date = await getPlayInfo(character.workId, character.lang, "premiered") ?? "";

    // filter out empty values
    let charText = [name, sex, socialClass, profession].filter(Boolean).join(", ");

    if (showPlayBtn) {
      charText += `<i
      class="char-list-show-play-unique-btn pointer fa-solid fa-magnifying-glass"
      data-workid=${workId}
      data-charid=${charId}
      data-lang=${lang}></i>`;
    }

    html += `<li>${charText}</li>`;

  });
  html += "</ul>";

  return html;
};

async function generatePlayTemplate(data: Play[], charsInPlayCard = false): Promise<string> {
  console.time("generatePlayTemplate")
  let html = "";
  try {
    // We define getPlayInfo() as async so that we can load data
    // which is not related to characters nor plays (e.g. authors, publishers)
    // while still doing other work in parallel.
    // playPromises is an array of promises, each of which resolves to a string
    // containing the HTML for a single play card.
    // ? check performance
    const playPromises = data.map(async (play: Play) => {
      const titleMain = play.titleMain;
      const titleSub = play.titleSub;
      const lang = play.lang;
      const authorId = play.authorId;
      const authorName = await getPlayInfo(authorId, lang, "author");
      //const publisher = getPlayInfo(play["publisher"], "publisher");

      // filter out empty values
      let playText = [titleMain, authorName].filter(Boolean).join("\n");

      if (charsInPlayCard) {
        // do not include char-list-show-play-unique-btn search icon
        // when adding chars to play card
        playText += generateCharacterTemplate(play.characters, false);
      }

      playText += `<i
      class="char-list-show-char-unique-btn pointer fa-solid fa-magnifying-glass"
      data-workid=${play.workId}
      data-lang=${play.lang}></i>`;

      html = `<div class="play-card">${playText}</div>`;

      return html;
    });

    // We need to wait for all promises to resolve before we can return the HTML.
    // Otherwise, the function will return before the promises resolve,
    // and [object Promise] will be returned instead.
    const playHtmlArray = await Promise.all(playPromises);
    html = playHtmlArray.join(""); // Combine HTML strings into a single string
    console.timeEnd("generatePlayTemplate");

    // we want to save the last template only if this function is not called
    // from showRelations() (i.e. charsInPlayCard is false)
    // so that we can show all previously shown plays when clicking
    // the char-list-show-play-unique-btn search icon again
    if (!charsInPlayCard) {
      currentPlayTemplate = html;
    }

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

async function getPlayInfo(id: number | number[], lang: string, type: string) : Promise<string|number> {
  //console.time("getPlayInfo")
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
          //console.timeEnd("getPlayInfo");
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

          //console.timeEnd("getPlayInfo");
          return authorNames.join(", ");
        }
      } catch (error) {
        console.error("Error getting play info:", error);
      };
  };
};

function getCharacter(workId: number, lang: string, charId: number) : Character {
  return charData.find((char: Character) =>
    char.workId === workId && char.lang === lang && char.characterId === charId
  );
}

function filterCharacters(charData: Character[]) : Character[] {
  console.time("filterCharacters");
  //possible values: fre, ger, als
  const langFilter = charFilters.lang;
  //possible values: M, F, B, U
  // B = both (if several chars); U = unknown
  const genderFilter = charFilters.sex;
  //todo: possible values: todo
  const professionFilter = charFilters.professionalGroup;
  //possible values: UC, MC, UMC, LC, LMC, LMC|UC
  const socialClassFilter = charFilters.socialClass;

  filteredCharData = charData.filter((char: Character) => {
    const langMatches = langFilter.length === 0 ||
      langFilter.some((filter: string) => filter === char.lang);

    const genderMatches = genderFilter.length === 0 ||
    genderFilter.some((filter: string) => filter === char.sex);

    const professionMatches = professionFilter.length === 0 ||
      professionFilter.some((filter: string) => filter === char.professionalGroup);

    const socialClassMatches = socialClassFilter.length === 0 ||
      socialClassFilter.some((filter: string) => filter === char.socialClass);

    return langMatches && genderMatches && professionMatches && socialClassMatches;
  });

  // activate "Show Plays" filter button
  // we only want to enable the button if the list is filtered
  // since all plays are shown by default
  $("#char-list-show-plays-btn, #char-list-sort-btn").removeClass("disabled");
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

    //const authorMatches =
      //authorFilter === "any" ||
      //todo: fix
      //play.authorId === authorFilter;

    const langMatches =
      langFilter === "any" ||
      play.lang === langFilter;

    //return publisherMatches && authorMatches && langMatches;
    return langMatches;
  });

  // activate "Show Characters" filter button
  // we only want to enable the button if the list is filtered
  // since all characters are shown by default
  $("#play-list-show-chars-btn").removeClass("disabled");

  totalShownPlayItems = filteredPlayData.length;

  console.timeEnd("filterPlays");
  return filteredPlayData;
}

async function updateView(dataType: string) {
  let filteredData: Character[] | Play[];
  console.log(`function updateView() called with args: ${dataType}`)
  switch (dataType) {
    case "characters":
      charCurrentPage = 1;
      filteredData = filterCharacters(charData);
      $("#char-list").html("");
      $("#char-list-pagination").html("");
      renderData("main-view-chars", filteredData, charCurrentPage);
      break;
    case "plays":
      playCurrentPage = 1;
      filteredData = filterPlays(playData)
      $("#play-list").html("");
      $("#play-list-pagination").html("");

      // highlight graph
      let dateRanges = null;
      // only if the list is filtered
      if (filteredData.length != playData.length) {
        const years = getDataYears(filteredData);
        dateRanges = findSuccessiveYears(years);
      }

      console.log("dateRanges", dateRanges)

      renderData("main-view-plays-table", filteredData, playCurrentPage, dateRanges);
      break;
  }

  $("#filter-reset-btn").removeClass("disabled");
};

function resetFilters() {
  // reset filter arrays
  charFilters = defaultCharFilters;
  //todo: uncomment when implementing play filters
  //playFilters = defaultPlayFilters;

  totalShownCharItems = charData.length;
  $("#char-list").html(currentCharTemplate);

  $(".play-header-text").text("Plays");
  $("#play-list").html(currentPlayTemplate);
  // show play progress again if hidden by showRelations()
  $(".play-progress").css("display", "inline");

  $("#char-list-show-plays-btn, #play-list-show-chars-btn, #filter-reset-btn")
  .addClass("disabled");
  $(".char-list-show-play-unique-btn, .filter-btn").removeClass("active");
};

function updateProgress() {
  preventScrollEvent = true;
  $(".main-view-chars, .main-view-plays-table").scrollTop(0);
  preventScrollEvent = false;

  $(".char-progress").text(`${totalShownCharItems}`);
  $(".play-progress").text(`${totalShownPlayItems}`);
}

async function showRelations(viewMode: string, unique: boolean, char: Character = null) : Promise<void> {
  console.time("showRelations");
  if (viewMode === "playsByChar") {
    const playsWithChars: Play[] = [];

    if (unique && char !== null) {
      // Logic used when list-show-play-unique-btn is clicked.
      // The initial idea was to change filteredCharData to [char]
      // and keep executing the next filteredCharData.forEach() block
      // (now in the else block),
      // but this caused the array to be replaced.
      //
      // Clicking the button again would stop plays
      // from being loaded by handlePagination()
      // because filteredCharData would only contain one character.
      playsWithChars.push({
        ...playData.find((play: Play) => play.workId === char.workId && play.lang === char.lang),
        characters: [char]
      });
    } else {
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
    }

    const playTemplate = await generatePlayTemplate(playsWithChars, true);
    $("#play-list").html(playTemplate);
    $(".play-header-text").text("Plays with " + char.persName)
    .next().css("display", "none"); // hide progress number and icons

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

    filteredCharData = charData;
    filteredPlayData = playData;

  } catch (error) {
    console.error("Error fetching data:", error);
  } finally {
    drawUI();
    $("#loader").hide();
  }
  console.timeEnd("fetchData");
};

async function drawUI() {
  // unneeded now because renderData()
  // const charTemplate = await getTemplate(charData, "characters");
  // const playTemplate = await getTemplate(playData, "plays");

  // currentCharTemplate = charTemplate;
  // currentPlayTemplate = playTemplate;

  timelineData = generateTimelineData(playData)
  setTimeline(timelineData);

  totalShownCharItems = charData.length;
  totalShownPlayItems = playData.length;
  $(".char-progress").text(`${totalShownCharItems}`);
  $(".play-progress").text(`${totalShownPlayItems}`);

  loadedCharData = charData.slice(0, itemsPerPage);
  loadedPlayData = playData.slice(0, itemsPerPage);

  renderData("main-view-chars", loadedCharData, charCurrentPage);
  renderData("main-view-plays-table", loadedPlayData, playCurrentPage);

  await fillFilterValues("characters");

  enableCharFilterBtns();

  // @ts-ignore | initialize tooltips
  $("[rel=tooltip]").tooltip();

  // disable "Show Plays", "Show Characters" and "Reset" buttons by default
  $("#char-list-show-plays-btn, #play-list-show-chars-btn, #filter-reset-btn")
  .addClass("disabled");
}

$(function () {
  fetchData();

  $("#char-list-show-plays-btn").on("click", function() {
    if ($(this).hasClass("disabled")) {
      return;
    }

    showRelations("playsByChar", false);
  });

  $("#play-list-show-chars-btn").on("click", function() {
    if ($(this).hasClass("disabled")) {
      return;
    }

    showRelations("charsByPlay", false);
  });

  $("#filter-reset-btn").on("click" , function() {
    if ($(this).hasClass("disabled")) {
      return;
    }

    resetFilters();
    updateProgress();
  });

  $(document).on("click", ".char-list-show-play-unique-btn", function() {
    // will reset the "Plays" view if the button is already active
    if ($(this).hasClass("active")) {
      $(".char-list-show-play-unique-btn").removeClass("active")

      $("#play-list").html(currentPlayTemplate);
      $(".play-header-text").text("Plays")
      .next().css("display", "flex"); // show progress number and icons again
      return;
    }

    const workId = $(this).data("workid");
    const charId = $(this).data("charid");
    const lang = $(this).data("lang");
    const char = getCharacter(workId, lang, charId);
    showRelations("playsByChar", true, char);

    // update appearance
    $(".char-list-show-play-unique-btn").removeClass("active");
    $(this).addClass("active");
  });

  $(".main-view-chars, .main-view-plays-table").on("scroll", function() {
    handleScroll(this, preventScrollEvent);
  });
});