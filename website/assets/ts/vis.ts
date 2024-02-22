import { Character, Play, Author, Publisher } from "./IEntity";
import { setTimeline, highlightGraphPeriod,
  clearGraphHighlight, clearLastSingleRectHighlight } from "../js-plugins/d3-timeline";

// These are professionalGroup values to be filtered out in fillFilterValues()
// we may convert them to null in the future
const invalidProfValues = ["n/a", "ignorer", "vague", "pas couvert", "unknown"]
// same for socialClass values
const invalidSocialClassValues = ["LMC|UC", "MC"]

const charFilterEls = {
  "lang": $("#filter-lang-values"),
  "sex": $("#filter-gender-values"),
  "professionalGroup": $("#filter-profession-values"),
  "socialClass": $("#filter-social-class-values"),
}

let charData: Character[] = [], playData: Play[] = [],
authorData: Author[] = [], publisherData: Publisher[] = [];

let filteredCharData: Character[] = [], filteredPlayData: Play[] = [];

// used to store characters that are part of plays filtered by date
// we cannot use filteredCharData as it's already used
// to go back to the previous view when deactivating a filter
let charsInPlaysDated: Character[] = [];

const defaultCharFilters = {
  lang: [],
  sex: [],
  professionalGroup: [],
  socialClass: [],
};
let charFilters = {...defaultCharFilters};

const defaultPlayFilters = {
  lang: [],
  publisher: [],
  author: [],
  dates: [],
};
let playFilters = {...defaultPlayFilters};

let originalCharTemplate: string, originalPlayTemplate: string;
let currentCharTemplate: string, currentPlayTemplate: string;

let totalShownCharItems = 0, totalShownPlayItems = 0;

let preventScrollEvent = false;

let timelineData = [];
let noDateRange = false;
let uniqueHighlightColor = "rgba(255, 204, 0, 0.5)"; // orange

/* Pagination */
let playCurrentPage = 1;
let charCurrentPage = 1;
const itemsPerPage = 50;
let loadedCharData: Character[] = [];
let loadedPlayData: Play[] = [];

/**
 * Fetches JSON data from file path and returns it as a Promise
 * @param path - path to JSON file
 * @returns - Promise containing JSON data
 */
function getJSON(path: string) : Promise<any> {
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
  return years.filter((year, index) =>
  years.indexOf(year) === index && year !== 0);
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

  if (currentRange.length === 0) {
    noDateRange = true;
  // add last range
  } else if (currentRange.length > 0) {
    noDateRange = false;
    // check if range has only one date
    // we need one beginning and one end date to create the highlight rect
    if (currentRange.length === 1) {
      currentRange.push(currentRange[0] + 1);
    }
    ranges[`range${Object.keys(ranges).length + 1}`] = currentRange;
  }

  return ranges;
}

async function renderData(elName: string, loadedData: Character[] | Play[], currentPage: number) {
  if ($("g.context").find("rect.highlight-rect").length > 0
      // only clear if we're on the first page
      // otherwise, caused the highlight to be cleared when scrolling
      && currentPage === 1) {
    clearGraphHighlight();
  }

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
  const template = elName === "main-view-chars" ? await generateCharacterTemplate(pageData as Character[]) :
    await generatePlayTemplate(pageData as Play[]);

  // console.log("pageData", pageData)
  // console.log("template", elName, template)
  // console.log(`function renderData() called with args: ${elName}, ${loadedData}, ${currentPage}`);
  // console.trace()

  let html = elName === "main-view-chars" ?
    $("#char-list").html() + `<p id="char-p-${currentPage}">Page ${currentPage}</p>` + template :
    $("#play-list").html() + `<span id="play-p-${currentPage}">Page ${currentPage}</span>` + template;

  if (elName === "main-view-chars") {
    $("#char-list").html(html);
  } else {
    $("#play-list").html(html);
  }

  // create option for pagination
  const selectId = elName === "main-view-chars" ?
  "#char-list-pagination" : "#play-list-pagination";
  const option = document.createElement("option");
  option.value = `#${elName.split("-")[2]}-p-${currentPage}`;

  option.innerHTML = `Page ${currentPage}`;
  // append option and change selected option to last loaded page
  $(selectId).append(option).val(option.value);
}

function handlePagination(e, currentPage: number, totalItems: number, filteredData: Character[] | Play[], loadedData) {
  const elName = e.className.split(" ")[1];
  let currentScrollPosition = e.scrollTop;
  const listHeight = elName === "main-view-chars" ? $("#char-list").height() :
   getPlayListHeight();
  const viewPortHeight = $(e).height();

  if (currentScrollPosition + viewPortHeight >= listHeight) {
    if (currentPage * itemsPerPage < totalItems) {
      currentPage++;
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

function scrollToPageNumber(pageNumber: number, type: string): void {
  preventScrollEvent = true;
  const anchor = document.getElementById(`${type}-p-${pageNumber}`);

  if (anchor) {
    anchor.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  } else {
    console.error(`No anchor found for page ${pageNumber}, type ${type}`);
  }
  preventScrollEvent = false;
}

function handleScroll(e, isScrollPrevented: boolean): void {
  if (isScrollPrevented) {
    return;
  }
  // unneeded?
  preventScrollEvent = false;

  const elName = e.className.split(" ")[1];
  if (elName === "main-view-chars") {
    handlePagination(e, charCurrentPage, totalShownCharItems, filteredCharData, loadedCharData);
  } else {
    handlePagination(e, playCurrentPage, totalShownPlayItems, filteredPlayData, loadedPlayData);
  }
}

function getPlayListHeight(): void {
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

async function fillFilterValues(dataType: string): Promise<void> {
  switch (dataType) {
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
      const originalProfValues = [];

      for (const key in charFilterEls) {
        const values = new Set();

        if (key === "professionalGroup") {
          for (const char of charData) {
            const originalValue = char.professionalGroup;

            // skip invalid values
            if (invalidProfValues.includes(originalValue)
            || originalValue === null
            // temporarily skip values with pipe (invalid values)
            || originalValue.includes("|")) continue;

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
          // temp fix for socialClass invalid values
          .filter(value => value !== null && !invalidSocialClassValues.includes(value));

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
      break;
    case "plays":
      fillSelect("publisher", "#select-pub");
      fillSelect("author", "#select-author");
      break;
    }
}

function enableFilterBtns() {
  $(".filter-btn").on("click", function() {
    const key = $(this).attr("name");
    let value = null;

    if (key !== "professionalGroup") {
      value = $(this).text();
    } else {
      value = $(this).data("og-value");
    }

    const isActive = $(this).hasClass("active");

    if (isActive) {
      $(this).removeClass("active");

      if (key === "lang") { // shared property
        charFilters[key] = charFilters[key].filter(item => item !== value);
        playFilters[key] = playFilters[key].filter(item => item !== value);

        updateView("characters", true);
        updateView("plays", true);
      } else if (key === "sex" || key === "professionalGroup" || key === "socialClass") {
        charFilters[key] = charFilters[key].filter(item => item !== value);
        updateView("characters");
      }

    } else {
      $(this).addClass("active");

      if (key === "lang") { // shared property
        charFilters[key].push(value);
        playFilters[key].push(value);

        updateView("characters", true);
        updateView("plays", true);
      } else if (key === "sex" || key === "professionalGroup" || key === "socialClass") {
        charFilters[key].push(value);
        updateView("characters");
      }
    }

    // activate "Show Plays" filter button
    // we only want to enable the button if the list is filtered
    // since all plays are shown by default
    if ($(".filter-btn.active").length > 0) {
      $("#char-list-show-plays-btn").removeClass("disabled");
    } else {
      $("#char-list-show-plays-btn").addClass("disabled");
      // fix bug that shows lower than expected number of items when
      // deactivating a character-related filter
      // probably because some matches cannot be found in plays
      totalShownPlayItems = playData.length;
    }

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
    onItemAdd: (id) => {
      playFilters[dataType].push(id);
      updateView("plays");
      updateProgress();
    },
    onItemRemove: (id) => {
      playFilters[dataType] = playFilters[dataType].filter(item => item !== id);
      updateView("plays");
      updateProgress();
    },
  });
};

async function generateCharacterTemplate(data: Character[], showPlayBtn = true): Promise<string> {
  if (data.length === 0) {
    return "<p>No characters found</p>";
  }

  let html = "";
  try {
    const charPromises = data.map(async (character: Character) => {
      let workId = character.workId;
      let charId = character.characterId;
      let lang = character.lang;
      let name = character.persName ?? "";
      let sex = character.sex ?? "";
      let socialClass = character.socialClass ?? "";
      let profession = character.professionalGroup ?? "";

      let charText = [name, sex, socialClass, profession]
      .map((item: string) => `<td>${item}</td>`).join("");

      if (showPlayBtn) {
        // add search icon as table data
        charText += `<td><i
        class="char-list-show-play-unique-btn pointer fa-solid fa-magnifying-glass"
        data-workid=${workId}
        data-charid=${charId}
        data-lang=${lang}></i></td>`;
      }

      html = `<tr>${charText}</tr>`;

      return html;
  });
      const charHtmlArray = await Promise.all(charPromises);
      html = charHtmlArray.join("");

      // show table header only on first page
      if (charCurrentPage === 1) {
        // leave 5th column empty for search icon
        html = `<thead><tr>
        <th scope="col">Name</th>
        <th scope="col">Gender</th>
        <th scope="col">Social Class</th>
        <th scope="col">Profession</th>
        <th scope="col"></th>
        </tr></thead>` + html;
      }

      return html;
  } catch (error) {
    console.error("Error generating character template:", error);
    return "";
  }
};

async function generatePlayTemplate(data: Play[], charsInPlayCard = false): Promise<string> {
  if (data.length === 0) {
    return "<p>No plays found</p>";
  }

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
      const lang = play.lang;

      const authorName = await getPlayInfo(play.authorId, lang, "author");
      //const publisher = await getPlayInfo(play.publisherId, lang, "publisher");

      // filter out empty values
      let playText = [titleMain, authorName].filter(Boolean).join("<br>");

      if (charsInPlayCard) {
        // do not include char-list-show-play-unique-btn search icon
        // when adding chars to play card
        // ?but why not?
        playText += await generateCharacterTemplate(play.characters, false);
        html = `<div class="play-card">${playText}</div>`;
        return html;
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

    // we want to save the last template only if this function is not called
    // from getRelations() (i.e. charsInPlayCard is false)
    // so that we can show all previously shown plays when clicking
    // the char-list-show-play-unique-btn search icon again
    if (!charsInPlayCard) {
      // there is a bug that causes "Page 1" not to be saved in the html
      // when clicking the char-list-show-play-unique-btn search icon again
      // to deactivate the "Plays with" view
      // may be caused by the fact that the "Page 1" string
      // is not part of the html generated for the "Plays with" view
      currentPlayTemplate = `<span id="play-p-1">Page 1</span>` + html;
    }

    return html;
  } catch (error) {
    console.error("Error generating play template:", error);
    return "";
  }
}

// async function getTemplate(data: Character[] | Play[], type: string): Promise<string> {
//   console.time("getTemplate")
//   if (type === "characters") {
//     console.timeEnd("getTemplate");
//     return generateCharacterTemplate(data as Character[]);
//   } else if (type === "plays") {
//     console.timeEnd("getTemplate");
//     return generatePlayTemplate(data as Play[]);
//   }

//   return "";
// };

async function getPlayInfo(id: number | number[], lang: string, type: string) : Promise<string|number> {
  //console.time("getPlayInfo")
  if (id === undefined) {
    return "Unknown";
  }

  switch (type) {
    case "publisher":
        // const publisherName = publisherData.find((publisher: Publisher) => {
        //   if (publisher.publisherId === id) {
        //     if (!publisher.normalizedName) {
        //       return;
        //     }
        //     return publisherName;
        //   }
        // });
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

    //! doesn't work
    // case "premiered":
    //   const premiered = playData.find((play: Play) =>
    //     play.workId === id && play.lang === lang).printed;
    //   return premiered;
  };
};

function getCharacter(workId: number, lang: string, charId: number) : Character {
  return charData.find((char: Character) =>
    char.workId === workId && char.lang === lang && char.characterId === charId
  );
}

function filterCharacters(charData: Character[]) : Character[] {
  //console.time("filterCharacters");
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

  totalShownCharItems = filteredCharData.length;

  //console.timeEnd("filterCharacters");
  return filteredCharData;
};

function filterPlays(playData: Play[]) : Play[] {
  const publisherFilter = playFilters.publisher;
  const authorFilter = playFilters.author;
  const langFilter = playFilters.lang;
  const dateFilter = playFilters.dates;

  filteredPlayData = playData.filter((play: Play) => {
    const publisherMatches = publisherFilter.length === 0 ||
    publisherFilter.some((filter: string) => filter === play.publisherId);

    const authorMatches = authorFilter.length === 0 ||
    authorFilter.some((filter: string) => {
      const author = authorData.find((author: Author) =>
      author.authorId === parseInt(filter));
      if (!author) {
        return false;
      }

      let matchingAuthor = false;
      if (play.authorId instanceof Array) {
        matchingAuthor = play.authorId.some((authorId: number) =>
        authorId === author.authorId);
      } else {
        matchingAuthor = play.authorId === author.authorId;
      }

      // check if author's language matches play's language
      return matchingAuthor && author.lang === play.lang;
    });

    const langMatches = langFilter.length === 0 ||
    langFilter.some((filter: string) => filter === play.lang);

    const dateMatches = dateFilter.length === 0 ||
    dateFilter.some((filter: Array<number>) => {
      const printed = +play.printed;
      return (printed >= filter[0] && printed <= filter[1]);
    });

    return publisherMatches && authorMatches && langMatches && dateMatches;
  });

  // activate "Show Characters" filter button
  // we only want to enable the button if the list is filtered
  // since all characters are shown by default
  $("#play-list-show-chars-btn").removeClass("disabled");

  totalShownPlayItems = filteredPlayData.length;

  //console.timeEnd("filterPlays");
  return filteredPlayData;
}

async function updateView(dataType: string, sharedProp = false) {
  let filteredData: Character[] | Play[];
  console.log(`function updateView() called with args: ${dataType}, sharedProp=${sharedProp}`)

  switch (dataType) {
    case "characters":
      charCurrentPage = 1;
      console.log("charData", charData)
      console.log("filteredCharData", filteredCharData)

      if (playFilters.dates.length > 0) {
        filteredData = filterCharacters(charsInPlaysDated);
      } else {
        filteredData = filterCharacters(charData);
      }

      $("#char-list").html("");
      $("#char-list-pagination").html("");
      renderData("main-view-chars", filteredData, charCurrentPage);

      // if ((!sharedProp) || sharedProp && (charFilters.sex.length > 0 || charFilters.professionalGroup.length > 0 || charFilters.socialClass.length > 0)) {
      //   getRelations("playsByChar", false);
      // } else {
      //   $("#play-list").html(originalPlayTemplate);
      // }
      getRelations("playsByChar", false);

      break;
    case "plays":
      if ((sharedProp) || sharedProp && (charFilters.sex.length < 0 || charFilters.professionalGroup.length < 0 || charFilters.socialClass.length < 0)) {
        console.log("returning, sharedProp", sharedProp, charFilters)
        return;
      }

      playCurrentPage = 1;
      if (!data) {
        filteredData = filterPlays(playData)
      } else {
        filteredData = data;
      }

      $("#play-list").html("");
      $("#play-list-pagination").html("");
      renderData("main-view-plays-table", filteredData, playCurrentPage);

      if (playFilters.publisher.length > 0 || playFilters.author.length > 0 || playFilters.dates.length > 0) {
        getRelations("charsByPlay", false);
      } else {
        //!rmv getRelations("charsByPlay", true);
        $("#char-list").html(originalCharTemplate);
      }

      // update highlight graph when using date filter w/o other filters
      if (playFilters.dates.length > 0 && playFilters.publisher.length === 0 && playFilters.author.length === 0) {
        setGraphHighlight(filteredData);
      }

      break;
  }

  $("#filter-reset-btn").removeClass("disabled");
};

function resetFilters() {
  // reset filter arrays
  charFilters = defaultCharFilters;
  playFilters = defaultPlayFilters;

  $("#char-list").html(originalCharTemplate);
  $("#play-list").html(originalPlayTemplate);

  // reset play-header-text if in "Plays with" view
  $(".play-header-text").text("Plays")
  .next().css("display", "inline"); // show progress number again
  $(".header-info[name='header-info-play']").css("display", "flex"); // show header info again

  $("#char-list-show-plays-btn, #play-list-show-chars-btn, #filter-reset-btn")
  .addClass("disabled");
  $(".char-list-show-play-unique-btn, .filter-btn").removeClass("active");

  // reset all pagination values except first page
  // do not one-line, breaks otherwise
  $("#char-list-pagination").find("option").not(":first").remove();
  $("#play-list-pagination").find("option").not(":first").remove();


  totalShownCharItems = charData.length;
  totalShownPlayItems = playData.length;
  charCurrentPage = 1;
  playCurrentPage = 1;

  clearGraphHighlight(true); // reset highlight and brush
};

function updateProgress() {
  preventScrollEvent = true;
  $(".main-view-chars, .main-view-plays-table").scrollTop(0);
  preventScrollEvent = false;

  $(".char-progress").text(`${totalShownCharItems}`);
  $(".play-progress").text(`${totalShownPlayItems}`);
}

async function getRelations(viewMode: string, unique: boolean, char: Character = null) : Promise<void> {
  //console.time("getRelations");
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

      $(".play-header-text").text("Plays with " + char.persName)
      .next().css("display", "none") // hide progress number
       // hide header info
      $(".header-info[name='header-info-play']").css("display", "none");
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

    //!
    totalShownPlayItems = playsWithChars.length;
    const playTemplate = await generatePlayTemplate(playsWithChars, false);
    $("#play-list").html(playTemplate);

    // only highlight graph if filtered
    if (totalShownPlayItems !== playData.length) {
      setGraphHighlight(playsWithChars, unique);
    }

    //renderData("main-view-plays-table", playsWithChars, playCurrentPage);

  } else if (viewMode === "charsByPlay") {
    const charsInPlays: Character[] = [];

    filteredPlayData.forEach((play: Play) => {
      charData.filter((char: Character) => char.workId === play.workId && char.lang === play.lang)
      .forEach((char: Character) => {
        charsInPlays.push(char);
      });
    });

    // This creates an explicit, global copy
    // of the charsInPlays array when data is filtered by date.
    // We need to have a copy available
    // to do further char-specific (gender; prof; class) filtering
    // on already date-filtered characters.
    //
    // That copy is subsequently used in updateView().
    //
    // Otherwise, applying a date filter would reset the character data.
    // This is not the best way to do it, but well...
    if (playFilters.dates.length > 0) {
      charsInPlaysDated = charsInPlays;
    }

    totalShownCharItems = charsInPlays.length;
    const charTemplate = await generateCharacterTemplate(charsInPlays);
    $("#char-list").html(charTemplate);
  }
};

function setGraphHighlight(data, highlightUnique = false) {
  let dateRanges = null;
  const years = getDataYears(data);
  dateRanges = findSuccessiveYears(years);
  for (const range in dateRanges) {
    const minYear = dateRanges[range][0];
    const maxYear = dateRanges[range][dateRanges[range].length - 1];
    if (highlightUnique) {
      highlightGraphPeriod(minYear, maxYear, uniqueHighlightColor);
    } else {
      highlightGraphPeriod(minYear, maxYear);
    }
  }
}

async function fetchData(): Promise<void> {
  //console.time("fetchData");
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
  //console.timeEnd("fetchData");
};

async function drawUI() {
  // unneeded now because renderData()
  // const charTemplate = await getTemplate(charData, "characters");
  // const playTemplate = await getTemplate(playData, "plays");

  // currentCharTemplate = charTemplate;
  // currentPlayTemplate = playTemplate;

  timelineData = generateTimelineData(playData)
  setTimeline(timelineData);

  //let [graphDateRangeStart, graphDateRangeEnd] = $("#displayDates").text().split(" - ");
  //console.log("graphDateRangeStart", graphDateRangeStart, "graphDateRangeEnd", graphDateRangeEnd)
  let debounceTimer;
  let observer = new MutationObserver(function(mutations) {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      mutations.forEach(function(mutation) {
        let [graphDateRangeStart, graphDateRangeEnd] = mutation.target.textContent.split(" - ");
        console.log("filteredPlayData0", filteredPlayData)
        playFilters.dates = [[+graphDateRangeStart, +graphDateRangeEnd]];
        console.log("filteredPlayData", filteredPlayData)
        //totalShownPlayItems = filteredPlayData.length;
        updateView("plays", false);
        updateProgress();
      });
    }, 300);
  });

  observer.observe($("#displayDates")[0], { childList: true });

  totalShownCharItems = charData.length;
  totalShownPlayItems = playData.length;
  $(".char-progress").text(`${totalShownCharItems}`);
  $(".play-progress").text(`${totalShownPlayItems}`);

  loadedCharData = charData.slice(0, itemsPerPage);
  loadedPlayData = playData.slice(0, itemsPerPage);

  renderData("main-view-chars", loadedCharData, charCurrentPage);
  renderData("main-view-plays-table", loadedPlayData, playCurrentPage);

  await fillFilterValues("characters");
  await fillFilterValues("plays");

  enableFilterBtns();

  originalCharTemplate = $("#char-list").html();
  originalPlayTemplate = $("#play-list").html();

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

    getRelations("playsByChar", false);
  });

  $("#play-list-show-chars-btn").on("click", function() {
    if ($(this).hasClass("disabled")) {
      return;
    }

    getRelations("charsByPlay", false);
  });

  $("#filter-reset-btn").on("click" , function() {
    if ($(this).hasClass("disabled")) {
      return;
    }

    resetFilters();
    updateProgress();
  });

  $("#char-list-pagination, #play-list-pagination").on("change", function(e) {
    const page = e.target.value.split("-")[2];
    const elName = e.target.id.split("-")[0];
    console.log(elName)
    scrollToPageNumber(page, elName);
  });

  // needs to be done at document level
  // because the buttons are dynamically created
  $(document).on("click", ".char-list-show-play-unique-btn", function() {
    // will reset the "Plays" view if the button is already active
    if ($(this).hasClass("active")) {
      $(".char-list-show-play-unique-btn").removeClass("active")

      $("#play-list").html(currentPlayTemplate);

      if (totalShownPlayItems === 1 && !noDateRange) {
        clearLastSingleRectHighlight();
      }

      $(".play-header-text").text("Plays")
      .next().css("display", "inline") // show progress number again
      $(".header-info[name='header-info-play']").css("display", "flex"); // show header info again
      return;
    }

    const workId = $(this).data("workid");
    const charId = $(this).data("charid");
    const lang = $(this).data("lang");
    const char = getCharacter(workId, lang, charId);
    getRelations("playsByChar", true, char);

    // update appearance
    $(".char-list-show-play-unique-btn").removeClass("active");
    $(this).addClass("active");
  });

  $(".main-view-chars, .main-view-plays-table").on("scroll", function() {
    handleScroll(this, preventScrollEvent);
  });
});