import { Character, Play, Author, Publisher, FilterMappings, Location, Setting, PublisherMapData } from "./IEntity";
import { setTimeline, updateTimelineLangPlot,
  clearGraphHighlight, raiseHandles, highlightGraphPeriod } from "../js-plugins/d3-timeline";
import { drawChart, setChart, updateChart } from "../js-plugins/d3-charts";
import { setMap } from "../js-plugins/map";

// These are values to be filtered out in fillFilterValues()
// we may convert them to null in the future
const invalidValues = {
  "professionalGroup": ["n/a", "ignorer", "vague", "pas couvert", "unknown"],
  "socialClass": ["LMC|UC", "MC"]
};

// FA icons used in table headers for sorting
const caretDownEl = `<i class="fa-solid fa-caret-down caret-force-visible"></i>`;
const caretUpEl = `<i class="fa-solid fa-caret-up caret-force-visible"></i>`;

const filterEls = {
  "char": {
    "lang": $("#filter-lang-values"),
    "sex": $("#filter-gender-char-values"),
    "professionalGroup": $("#filter-profession-values"),
    "socialClass": $("#filter-social-class-values"),
  },
  "play": {
    "genre": $("#filter-genre-values"),
  },
  "author": {
    "sex": $("#filter-gender-author-values"),
  }
};

let charData: Character[] = [], playData: Play[] = [],
authorData: Author[] = [], publisherData: Publisher[] = [],
locData: Location[] = [], settingData: Setting[] = [];

let filteredCharData: Character[] = [], filteredPlayData: Play[] = [];

// used to store characters that are part of plays filtered by
// play-specific filters (dates, publisher, author)
// we cannot use filteredCharData as it's already used
// to go back to the previous view when disabling a filter
let filteredCharsInPlays: Character[] = [];
// same for plays with characters
let filteredPlaysWithChars: Play[] = [];

let authorSelectData: { value: number, text: string }[] = [];
let pubSelectData: { value: number, text: string }[] = [];

const defaultCharFilters = {
  lang: [],
  sex: [],
  professionalGroup: [],
  socialClass: [],
  searchInput: "",
};
let charFilters = defaultCharFilters;

const defaultPlayFilters = {
  lang: [],
  genre: [],
  publisher: [],
  author: [],
  sex: [],
  dates: [],
  searchInput: "",
};
let playFilters = defaultPlayFilters;

let filterMappings: FilterMappings = {};

let originalCharTemplate: string, originalPlayTemplate: string;
let currentCharTemplate: string, currentPlayTemplate: string;

let totalShownCharItems = 0, totalShownPlayItems = 0;
let allCharsShown = false;

let timelineData = [];

// vars used for pagination
let playCurrentPage = 1;
let charCurrentPage = 1;
const itemsPerPage = 50;
let loadedCharData: Character[] = [];
let loadedPlayData: Play[] = [];

let preventScrollEvent = false;

let currentGraphType: string;

let isMapSet = false;

/**
 * Fetches JSON data from file path and returns it as a Promise.
 * @param path - The path to the JSON file.
 * @returns A Promise containing JSON data.
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
 * Calculates the count of data by year, grouped by language.
 * @param data - An array of Play objects.
 * @returns An array of objects containing the year, value, and language.
 */
function getDataCountByYear(data: Play[]) : { year: number, value: number, lang: string }[] {
  // we're using plays to get years of the data
  // because it has the "printed" property
  const [minPlayDataYear, maxPlayDataYear] = getMinMaxPlayDataYear(data);

  // array used to generate data with zero values for years with no data
  // so that the timeline graph can be generated correctly
  const allYears = Array.from({ length: maxPlayDataYear - minPlayDataYear + 1 },
    (_, i) => i + minPlayDataYear);

  const uniqueLangs = Array.from(new Set(data.map(item => item.lang)));

  const dataObj = data.map(item => {
    return {
      year: +item.printed,
      value: data.filter(play => (play.printed === item.printed && play.lang === item.lang)).length,
      lang: item.lang
    };
  }).filter(y => y.year !== 0 && !isNaN(y.year));

  const dataCountByYear = allYears.flatMap(year => {
    return uniqueLangs.map(lang => {
      const yearData = dataObj.find(y => y.year === year && y.lang === lang);
      return yearData || { year, value: 0, lang };
    });
  });

  return dataCountByYear;
};

/**
 * Returns an array of objects containing the year pair and language for each play.
 * Used to draw rectangles in the timeline graph.
 * @param data - An array of Play objects.
 * @returns An array of objects with year1, year2, and lang properties.
 */
function getYearPair(data: Play[]) : { year1: number, year2: number, lang: string } {
  return data.map((item: Play) => {
    return {
      year1: +item.printed,
      year2: +item.printed + 1,
      lang: item.lang
    };
  }).filter(y => y.year1 !== 0 && !isNaN(y.year1))
  .reduce((acc, curr) => ({ ...acc, ...curr }), { year1: 0, year2: 0, lang: "" });
};

/**
 * Calculates the minimum and maximum year of the printed plays in the given data.
 * @param data - An array of Play objects.
 * @returns - An array containing the minimum and maximum year.
 */
function getMinMaxPlayDataYear(data: Play[]) : number[] {
  const minYear = Math.min(...data.map((item: Play) => +item.printed)
  .filter(year => !isNaN(year) && year !== 0));
  const maxYear = Math.max(...data.map((item: Play) => +item.printed)
  .filter(year => !isNaN(year)));

  return [minYear, maxYear];
};

/**
 * Renders the data to the specified element based on the loaded data and current page.
 * @param elName - The name of the element to render the data to.
 * @param loadedData - The loaded data to be rendered.
 * @param currentPage - The current page number.
 */
async function renderData<T extends Character | Play>(elName: string, loadedData: T[], currentPage: number) : Promise<void> {
  if ($("g.context").find("rect.highlight-rect").length > 0
      // only clear if we're on the first page
      // otherwise, caused the highlight to be cleared when scrolling
      && currentPage === 1) {
  }

  if (loadedData.length === 0) {
    if (elName === "main-view-chars") {
      $("#char-list").html("<p>No characters found</p>");
    } else {
      $("#play-list").html("<p>No plays found</p>");
      $("#play-list-sort-btn").addClass("disabled");
    }
    return;
  }

  const pageData = loadedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const template = elName === "main-view-chars" ?
  await generateCharacterTemplate(pageData as Character[]) :
  await generatePlayTemplate(pageData as Play[]);

  // only show anchor if all data to be loaded > itemsPerPage
  let anchorEl = "";
  if (elName === "main-view-chars" && filteredCharData.length > itemsPerPage) {
    anchorEl = `<div id="char-p-${currentPage}"><span class="page-circle">${currentPage}</span></div>`
  } else if (elName === "main-view-plays-table" && filteredPlayData.length > itemsPerPage) {
    anchorEl = `<div id="play-p-${currentPage}"><span class="page-circle">${currentPage}</span></div>`
  }

  let html = elName === "main-view-chars" ?
    $("#char-list").html() + anchorEl + template :
    $("#play-list").html() + anchorEl + template;

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
};

/**
 * Shows all characters.
 */
async function showAllCharData() : Promise<void> {
  if (allCharsShown) {
    return;
  }

  const template = await generateCharacterTemplate(charData);
  $("#char-list").html(template);
  $("#char-list-pagination").remove();
  $("#char-list-show-all-btn").addClass("disabled");
  $("#filter-reset-btn").removeClass("disabled");
};

/**
 * Handles pagination for the given data.
 * @param e - The event object.
 * @param currentPage - The current page number.
 * @param totalItems - The total number of items.
 * @param filteredData - The filtered data array.
 * @param loadedData - The array of loaded data.
 */
function handlePagination<T extends Character | Play>(e: HTMLElement, currentPage: number, totalItems: number, filteredData: T[], loadedData: T[]) : void {
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
      //console.log(`Loading page ${currentPage} of ${elName} with ${newData.length} items`);
      renderData(elName, loadedData, currentPage);
    }
  }

  if (elName === "main-view-chars") {
    charCurrentPage = currentPage;
  } else {
    playCurrentPage = currentPage;
  }
};

/**
 * Scrolls to the specified page number of a given type.
 * @param pageNumber - The page number to scroll to.
 * @param type - The type of entity page to scroll within.
 */
function scrollToPageNumber(pageNumber: string, type: string): void {
  preventScrollEvent = true;
  const anchor = document.getElementById(`${type}-p-${pageNumber}`);

  if (anchor) {
    anchor.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  } else {
    console.error(`No anchor found for page ${pageNumber}, type ${type}`);
  }
  preventScrollEvent = false;
};

/**
 * Handles the scroll event.
 * @param e - The HTML element that triggered the scroll event.
 * @param isScrollPrevented - Indicates whether the scroll event is prevented.
 */
function handleScroll(e: HTMLElement, isScrollPrevented: boolean): void {
  if (isScrollPrevented) {
    return;
  }
  // unneeded?
  //preventScrollEvent = false;

  const elName = e.className.split(" ")[1];
  if (elName === "main-view-chars") {
    handlePagination(e, charCurrentPage, totalShownCharItems, filteredCharData, loadedCharData);
  } else {
    handlePagination(e, playCurrentPage, totalShownPlayItems, filteredPlayData, loadedPlayData);
  }
};

/**
 * Calculates the height of the playlist based on the height of its rows.
 * @returns The height of the playlist in pixels.
 */
function getPlayListHeight(): number {
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
};

/**
 * Enable sort rows feature
 * Modified from https://stackoverflow.com/questions/3160277/jquery-table-sort
 */
function enableSortRows() : void {
  $(document).on("click", "th", function() {
    const table = $(this).parents("table").eq(0);
    const ths = table.find("th");
    let rows = table.find("tr:gt(0)").toArray().sort(comparer($(this).index()));
    this.asc = !this.asc;

    // Clear existing carets
    Array.from(ths).forEach(th => {
      $(th).find(".fa-caret-down").removeClass("caret-force-visible");
      $(th).find(".fa-caret-up").removeClass("caret-force-visible");
    });

    if (!this.asc) {
      rows = rows.reverse();
      $(this).find(".fa-caret-down").addClass("caret-force-visible");
    } else {
      $(this).find(".fa-caret-up").addClass("caret-force-visible");
    }
    for (let i = 0; i < rows.length; i++) {
      {table.append(rows[i])}
    }
  });

  /**
   * Creates a comparer function for sorting HTML table rows based on a specific column.
   * @param index - Index of the column to compare.
   * @returns A comparer function that takes two HTML table cells and returns a number indicating their relative order.
   */
  function comparer(index: number) : (a: HTMLTableRowElement, b: HTMLTableRowElement) => number {
    /**
     * Gets cell value.
     * @param row - Row to get value from.
     * @param index - Index of the column to get value from.
     */
    function getCellValue(row: HTMLTableRowElement, index: number) : string {
      return $(row).children("td").eq(index).text();
    }

    /** Checks if a value is numeric and finite.
     * @param n - Number or string to check.
     * @returns - Whether n is a number or string; and is finite.
     */
    function isNumeric(n: number | string) {
      return !isNaN(parseFloat(n as string)) && isFinite(n as number);
    }

    return function(a: HTMLTableRowElement, b: HTMLTableRowElement) {
      const valA = getCellValue(a, index);
      const valB = getCellValue(b, index);
      return isNumeric(valA) && isNumeric(valB) ? parseInt(valA) - parseInt(valB)
      : valA.toString().localeCompare(valB);
    };
  }
};

/**
 * Creates an object with the count of each year in the data
 * to be used to generate the D3.js timeline.
 * @param data - Array of Play objects.
 * @returns Array of objects with year and count properties.
 */
function generateTimelineData(data: Play[]) : { year: string, count: number }[] {
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

/**
 * Fills the filter values for authors, plays, and characters based on the provided filter mappings.
 * @param filterMappings - Mappings used to map filter values to display values.
 * @returns Promise that resolves when the filter values have been filled.
 */
async function fillFilterValues(filterMappings: FilterMappings): Promise<void> {
  // fill filter values for authors
  for (const key in filterEls.author) {
    const values = new Set(authorData.map((author: Author) =>
    // order: M, F, U
    author[key]).sort((a, b) => {
      const order: Record<string, number> = { M: 0, F: 1, U: 2 };
      return order[a] - order[b];
    }));
    const select = filterEls.author[key];

    values.forEach((value : string) => {
      const option = document.createElement("button");
      option.name = key;
      option.dataset.type = "author";
      option.title = filterMappings[key][value];
      option.textContent = value;
      $(option).addClass("filter-btn");
      select.append(option);
    });
  }

  // fill filter values for plays
  fillSelect("publisher", "#select-pub");
  fillSelect("author", "#select-author");

  for (const key in filterEls.play) {
    const select = filterEls.play[key];
    if (key === "genre") {
      const genreMapping = filterMappings.genre;
      const genreKeys = Object.keys(genreMapping);

      genreKeys.forEach((genreKey) => {
        const option = document.createElement("button");
        option.name = "genre";
        option.textContent = genreKey;
        $(option).addClass("filter-btn");
        select.append(option);
      });
    } else {
      const values = new Set(playData.map((play: Play) => play[key]));
      values.forEach((value : string) => {
        if (value === null) return;

        const option = document.createElement("button");
        option.name = key;
        option.textContent = value;
        $(option).addClass("filter-btn");
        select.append(option);
      });
    }
  }

  // fill filter values for characters
  // Keep an array of original (long) professionalGroup values
  // to later set the og-value attribute of the Profession filter buttons.
  // We set the og-value attribute to the original value
  // because Character's professionalGroup values
  // are not the mapped (abbreviated) ones, but the original ones.
  // Not doing this would make it impossible to filter professions.
  const originalProfValues = [];

  for (const key in filterEls.char) {
    const values = new Set();

    if (key === "professionalGroup") {
      for (const char of charData) {
        const originalValue = char.professionalGroup;

        // skip invalid values
        if (invalidValues.professionalGroup.includes(originalValue)
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
      .filter(value => value !== null &&
        !invalidValues.socialClass.includes(value));

      newValues.forEach(value => values.add(value));
    }

    const select = filterEls.char[key];
    values.forEach((value : string) => {
      const option = document.createElement("button");
      option.name = key;
      option.dataset.type = "char";
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
};

/**
 * Enables the filter buttons functionality.
 * When a filter button is clicked, toggles the active state
 * and applies or removes the corresponding filter.
 * Also updates the view based on the applied filters.
 */
function enableFilterBtns() {
  $(".filter-btn").on("click", function() {
    // check if magnifier view is enabled
    // if so, since we're dealing with filters,
    // it needs to be disabled completely
    // to show relevant filtered data
    const activeMagnifierEls =
    [".play-list-show-char-unique-btn", ".char-list-show-play-unique-btn"]
    .filter((el) => $(el).hasClass("active"));

    if (activeMagnifierEls.length > 0) {
      const el = activeMagnifierEls[0];
      $(el).removeClass("active");

      // is the button for showing plays or characters?
      const isChars = el === ".char-list-show-play-unique-btn";

      const headerText = isChars ? ".play-header-text" : ".char-header-text";
      $(headerText)
        .text(isChars ? "Plays" : "Characters")
        .next()
        .css("display", "inline"); // show progress number again

      // enable timeline again
      $(".resize, .brush, .pane").removeClass("tl-disabled");
    }

    // reset pagination
    $("#char-list-pagination").find("option").not(":first").remove();
    $("#play-list-pagination").find("option").not(":first").remove();

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
      } else if ((key === "sex" && $(this).attr("data-type") == "char")
      || key === "professionalGroup"
      || key === "socialClass") {
        charFilters[key] = charFilters[key].filter(item => item !== value);
        const isPlayFiltered = Object.values(playFilters).some((filter) => filter.length > 0);
        if (isPlayFiltered) {
          // if we keep both, change updateView logic so that results do not appear twice
          updateView("characters");
          updateView("plays");
        } else {
          updateView("characters");
        }
      } else if (key === "genre") {
        playFilters[key] = playFilters[key].filter(item => item !== value);
        updateView("plays");
      } else if (key === "sex" && $(this).attr("data-type") == "author") {
        playFilters[key] = playFilters[key].filter(item => item !== value);
        const isCharFiltered = Object.values(charFilters).some((filter) => filter.length > 0);
        if (isCharFiltered) {
          updateView("characters");
          updateView("plays");
        } else {
          updateView("plays");
        }
      } else {
        console.error("Invalid filter button key found when removing filter:", key);
      }

    } else {
      $(this).addClass("active");

      if (key === "lang") { // shared property
        charFilters[key].push(value);
        playFilters[key].push(value);

        updateView("characters", true);
        updateView("plays", true);
      } else if ((key === "sex" && $(this).attr("data-type") == "char")
      || key === "professionalGroup"
      || key === "socialClass") {
        charFilters[key].push(value);
        const isPlayFiltered = Object.values(playFilters).some((filter) => filter.length > 0);
        if (isPlayFiltered) {
          updateView("characters");
        } else {
          updateView("characters");
        }
      } else if (key === "genre") {
        playFilters[key].push(value);
        updateView("plays");
      } else if (key === "sex" && $(this).attr("data-type") == "author") {
        playFilters[key].push(value);
        updateView("plays");
      } else {
        console.error("Invalid filter button key found when adding filter:", key);
      }
    }
  });
}

/**
 * Fills a TomSelect element with data based on the specified data types
 * @param dataType - The type of data to fill the select element with.
 * @param selectId - The ID of the TomSelect element to fill.
 */
function fillSelect(dataType: string, selectId: string) : void {
  let data: { value: string, text: string }[];

  switch (dataType) {
    case "publisher":
      data = publisherData
      .map((publisher: Publisher) => ({
        // value is a custom id (combination of lang and publisherId),
        // as we need to know both to filter correctly
        value: publisher.lang + publisher.publisherId,
        // some publisher values have no normalizedName
        text: (publisher.normalizedName ?? publisher.nameOnPlay) +" (" +
        getNumberOfPlaysByIdAndLang(playData, publisher.publisherId, publisher.lang, "publisher") + ")"
      }))
      break;
    case "author":
      data = authorData.map((author: Author) => ({
        // value is a custom id (combination of lang and authorId),
        // as we need to know both to filter correctly
        value: author.lang + author.authorId,
        text: author.fullName + " (" +
        getNumberOfPlaysByIdAndLang(playData, author.authorId, author.lang, "author") + ")"
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
    onItemAdd: (id: string) => {
      playFilters[dataType].push(id);
      updateView("plays", false);
    },
    onItemRemove: (id: string) => {
      playFilters[dataType] = playFilters[dataType].filter(item => item !== id);
      //! seems like we need to update characters instead
      updateView("characters", false);
    },
  });

  if (dataType === "author") {
    // create shallow copy of select data to be used for reset
    // @ts-ignore
    authorSelectData = {...document.getElementById("select-author").tomselect.options};
  } else if (dataType === "publisher") {
    // create shallow copy of select data to be used for reset
    // @ts-ignore
    pubSelectData = {...document.getElementById("select-pub").tomselect.options};
  }
};

/**
 * Updates the specified select option with a new text and count
 * @param selectId - The ID of the select element.
 * @param optionValue - The value of the option to be updated.
 * @param includeCount - Whether to include the count in the new option text.
 * @param newCount - The new count to be included in the option text.
 */
function updateSelectOption(selectId: string, optionValue: string, includeCount = false, newCount: number = 0) : void {
  // @ts-ignore
  const select = document.getElementById(selectId).tomselect;
  const option = select.options[optionValue];
  const newOptionText = includeCount ?
  option.text.split(" (")[0] + " (" + newCount + ")" : option.text.split(" (")[0]

  if (!option) {
    console.error(`Option with value ${optionValue} not found in select ${selectId}`);
    return;
  }

  select.updateOption(optionValue, {
    value: optionValue,
    text: newOptionText
  });
};

/**
 * Updates the author and publisher select elements with new counts.
 */
function updateCreatorSelects() : void {
  authorData.forEach((author: Author) => {
    updateSelectOption("select-author", author.lang + author.authorId,
    //! getNumberOfPlaysByIdAndLang is broken; sometimes returns zero when filtering :(
    //! temp fix: hide count when filtering
    //getNumberOfPlaysByIdAndLang(filteredData, author.authorId, author.lang, "author"));
    false);
  });

  publisherData.forEach((publisher: Publisher) => {
    updateSelectOption("select-pub", publisher.lang + publisher.publisherId,
    //getNumberOfPlaysByIdAndLang(filteredData, publisher.publisherId, publisher.lang, "publisher"));
    false);
  });
};

/**
 * Handles the search functionality for plays and characters.
 * @param el - An HTMLInputElement representing the search input element.
 */
function handleSearch(el: HTMLInputElement) : void {
  const entity = el.id.split("-")[0];

  if (entity === "char") {
    charFilters.searchInput = el.value;
    updateView("characters");
  } else if (entity === "play") {
    playFilters.searchInput = el.value;
    updateView("plays");
  } else {
    console.error("Invalid entity for search:", entity);
  }
}

/**
 * Generates a character template based on the provided data.
 * @param data - An array of Character objects.
 * @param showPlayBtn - Specifies whether to show the magnifier button to show the play in which the character appears.
 * @param minified - Specifies whether the template should include table headers.
 * @param unique - Specifies whether we're in magnifier mode.
 * @returns Promise that resolves to a string representing the generated character template.
 */
async function generateCharacterTemplate(data: Character[], showPlayBtn = true, minified = false, unique = false): Promise<string> {
  if (data.length === 0) {
    return "<p>No characters found</p>";
  }

  let html = "";
  try {
    const charPromises = data.map(async (character: Character) => {
      const workId = character.workId;
      const charId = character.characterId;
      const lang = character.lang;
      const name = character.persName ?? "";
      const sex = character.sex ?? "";
      const profession = character.professionalGroup ?? "";
      const socialClass = character.socialClass ?? "";
      const date = await getPlayInfo(workId, lang, "playObject")
      .then((play: Play) => { return play.printed; }) ?? "";

      let charText = [name, sex, profession, socialClass, date]
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

      if (!minified) {
      // show table header only on first page
        if (charCurrentPage === 1) {
          // leave 5th column empty for search icon
          html = `<thead><tr>
          <th scope="col">Name<br>${caretDownEl} ${caretUpEl}</th>
          <th scope="col">Gender<br>${caretDownEl} ${caretUpEl}</th>
          <th scope="col">Profession<br>${caretDownEl} ${caretUpEl}</th>
          <th scope="col">Soc. Class<br>${caretDownEl} ${caretUpEl}</th>
          <th scope="col">Date<br>${caretDownEl} ${caretUpEl}</th>
          <th scope="col"></th>
          </tr></thead>` + html;
        }
      }

      if (!unique) {
        currentCharTemplate = `<div id="char-p-1"><span class="page-circle">1</span></div>` + html;
      }

      return html;
  } catch (error) {
    console.error("Error generating character template:", error);
    return "";
  }
};

/**
 * Generates a play template based on the provided data.
 * @param data - An array of Play objects.
 * @param unique - Specifies whether we're in magnifier mode.
 * @returns Promise that resolves to a string representing the generated play template.
 */
async function generatePlayTemplate(data: Play[], unique = false): Promise<string> {
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
    const playPromises = data.map(async (play: Play) => {
      const titleMain = play.titleMain;
      const date = play.printed ?? "";
      const authorName = await getPlayInfo(play.authorId, play.lang, "authorName");
      const genre = play.genre;

      const capitalizedGenre = genre ? genre.charAt(0).toUpperCase() + play.genre.slice(1) : "";

      let titleMainDated = `<span class="play-title">${titleMain.trim()}</span>`
      if (date) {
        titleMainDated += ` <span class="play-date">(${date})</span>`;
      }

      const authorNameFormatted = `<span class="play-author">${authorName}</span>`;
      const genreFormatted = `<span class="play-genre">${capitalizedGenre}</span>`;

      // filter out empty values
      let playText = [titleMainDated, authorNameFormatted, genreFormatted].filter(Boolean).join("<br>");

      // wrap info into div for styling
      playText = `<div class="play-card-info">${playText}</div>`

      if (unique) {
        // do not include char-list-show-play-unique-btn search icon
        // when showing unique play card for character
        // this creates side effects when using both magnifier modes;
        // may fix later
        html = `<div class="play-card" data-lang="${play.lang}">${playText}</div>`;
        return html;
      }

      playText += `<i
      class="play-list-show-char-unique-btn pointer fa-solid fa-magnifying-glass"
      data-workid=${play.workId}
      data-lang=${play.lang}></i>`;

      // include data-lang property for language-specific play card styling
      html = `<div class="play-card" data-lang="${play.lang}">${playText}</div>`;

      return html;
    });

    // We need to wait for all promises to resolve before we can return the HTML.
    // Otherwise, the function will return before the promises resolve,
    // and [object Promise] will be returned instead.
    const playHtmlArray = await Promise.all(playPromises);
    html = playHtmlArray.join(""); // Combine HTML strings into a single string

    // we want to save the last template only if this function is not called
    // from showRelations() (i.e. unique is false)
    // so that we can show all previously shown plays when clicking
    // the char-list-show-play-unique-btn search icon again
    if (!unique) {
      // there is a bug that causes "Page 1" not to be saved in the html
      // when clicking the char-list-show-play-unique-btn search icon again
      // to disable the "[char] appears in" view
      // may be caused by the fact that the "Page 1" string
      // is not part of the html generated for the "[char] appears in" view
      const spanPageEl = `<div id="play-p-1"><span class="page-circle">1</span></div>`;
      currentPlayTemplate = spanPageEl + html;
    }

    return html;
  } catch (error) {
    console.error("Error generating play template:", error);
    return "";
  }
}

/**
 * Retrieves play information based on the provided parameters.
 * @param id - ID of the play (or an array of IDs if there are multiple authors for one play).
 * @param lang - Language of the play.
 * @param type - Type of information to retrieve (e.g., authorName, authorSex, playObject).
 */
async function getPlayInfo(id: number | number[], lang: string, type: string) : Promise<string|string[]|number|Play> {
  if (id === undefined) {
    return "Unknown";
  }

  switch (type) {
    case "authorName":
      try {
        if (typeof id === "number") {
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

          return authorNames.join(", ");
        }
      } catch (error) {
        console.error("Error getting play info for type 'authorName':", error);
      };
      break;

    case "authorSex":
      try {
        if (typeof id === "number") {
          const authorSex = authorData.find((author: Author) =>
          author.authorId === id && author.lang === lang).sex;
          return authorSex;
        } else if (id instanceof Array) {
          const authorSexes = id.map((authorId: number) =>
            authorData.find((author: Author) =>
              author.authorId === authorId && author.lang === lang).sex
          );
          return authorSexes;
        }
      } catch (error) {
        console.error("Error getting play info for type 'authorSex':", error);
      };
      break;

    case "playObject":
      try {
        const play = playData.find((play: Play) =>
          play.workId === id && play.lang === lang);

        return play;
      } catch (error) {
        console.error("Error getting play info for type 'playObject':", error);
      };
      break;
  };
};

/**
 * Retrieves a character based on the specified work ID, language, and character ID.
 * @param workId - ID of the play.
 * @param lang - Language of the character.
 * @param charId - ID of the character.
 */
function getCharacter(workId: number, lang: string, charId: number) : Character | undefined {
  return charData.find((char: Character) =>
    char.workId === workId && char.lang === lang && char.characterId === charId
  );
}

/**
 * Returns the number of plays based on the provided parameters.
 * @param data - An array of Play objects.
 * @param id - ID of the author or publisher.
 * @param lang - Language of the plays.
 * @param type - Type of filter to apply (either "author" or "publisher").
 */
function getNumberOfPlaysByIdAndLang(data: Play[], id: number, lang: string, type: string) : number {
  switch (type) {
    case "author":
      return data.filter((play: Play) => {
        if (play.authorId instanceof Array) {
          return play.authorId.some((authorId: number) =>
            authorId === id && play.lang === lang);
        } else {
          return play.authorId === id && play.lang === lang;
        }
      }).length;
    case "publisher":
      return data.filter((play: Play) =>
        play.publisherId === id && play.lang === lang).length;
  }
}

/**
 * Retrieves the publisher map data.
 * @returns Promise that resolves to the PublisherMapData object.
 */
async function getPublisherMapData(): Promise<PublisherMapData> {
  const publisherMapData = {} as PublisherMapData;

  for (const publisher of publisherData) {
    const publisherId = publisher.publisherId;
    const lang = publisher.lang;
    const publisherName = publisher.normalizedName;
    const placeId = publisher.placeId;
    const play = playData.find((play: Play) =>
      play.publisherId == publisherId && play.lang === lang);

    let [playName, authorNames, playDate] = "";
    if (play) {
      playName = play.titleMain;
      playDate = play.printed;
      const authorId = play.authorId;
      authorNames = await getPlayInfo(authorId, lang, "authorName").catch((err) => {
        console.error("Error getting author names:", err);
        return "";
      }) as string;
   }

    publisherMapData[lang + publisherId] = {
      publisherName,
      lang,
      placeId,
      playName,
      playDate,
      authorNames,
    };
  };

  return publisherMapData;
}

/**
 * Filters an array of characters based on the provided filters.
 * @param charData - The array of characters to be filtered.
 * @returns The filtered array of characters.
 */
function filterCharacters(charData: Character[]) : Character[] {
  // see filter_map.json for possible values
  const langFilter = charFilters.lang;
  const genderFilter = charFilters.sex;
  const professionFilter = charFilters.professionalGroup;
  const socialClassFilter = charFilters.socialClass;
  const searchFilter = charFilters.searchInput;

  filteredCharData = charData.filter((char: Character) => {
    const langMatches = langFilter.length === 0 ||
      langFilter.some((filter: string) => filter === char.lang);

    const genderMatches = genderFilter.length === 0 ||
      genderFilter.some((filter: string) => filter === char.sex);

    const professionMatches = professionFilter.length === 0 ||
      professionFilter.some((filter: string) => filter === char.professionalGroup);

    const socialClassMatches = socialClassFilter.length === 0 ||
      socialClassFilter.some((filter: string) => filter === char.socialClass);

    const nameMatches = searchFilter.length === 0 ||
      char.persName?.toLowerCase().includes(searchFilter.toLowerCase());

    return langMatches && genderMatches && professionMatches
    && socialClassMatches && nameMatches;
  });

  totalShownCharItems = filteredCharData.length;

  return filteredCharData;
};

/**
 * Retrieves the sex of the author(s) based on the provided author ID(s) and language.
 * @param authorId The ID(s) of the author(s).
 * @param lang The language of the author(s).
 * @returns The sex of the author(s).
 */
function getAuthorSex(authorId: number | number[], lang: string) : string | string[] {
  if (typeof authorId === "number") {
    return authorData.find((author: Author) =>
      author.authorId === authorId && author.lang === lang).sex;
  } else if (authorId instanceof Array) {
    return authorId.map((authorId: number) =>
      authorData.find((author: Author) =>
        author.authorId === authorId && author.lang === lang).sex);
  }
};

/**
 * Filters an array of Play objects based on various filters.
 * @param playData - The array of Play objects to be filtered.
 * @returns An array of Play objects that match the specified filters.
 */
function filterPlays(playData: Play[]) : Play[] {
  const publisherFilter = playFilters.publisher;
  const authorFilter = playFilters.author;
  const authorSexFilter = playFilters.sex;
  const langFilter = playFilters.lang;
  const genreFilter = playFilters.genre;
  const dateFilter = playFilters.dates;
  const searchFilter = playFilters.searchInput;

  filteredPlayData = playData.filter((play: Play) => {
    const publisherMatches = publisherFilter.length === 0 ||
    publisherFilter.some((filter: string) => {
      // value in dropdown is a custom id (lang + publisherId)
      const matchingPublisher = play.lang + play.publisherId === filter;

      if (matchingPublisher) {
        const publisher = publisherData.find((publisher: Publisher) =>
            publisher.lang + publisher.publisherId === filter
        );

        return publisher;
        //return publisher && publisher.lang === play.lang;
      }
    });

    const authorMatches = authorFilter.length === 0 ||
    authorFilter.some((filter: string) => {
      const author = authorData.find((author: Author) =>
      // value in dropdown is a custom id (lang + authorId)
      author.lang + author.authorId === filter);
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

    const authorSexMatches = authorSexFilter.length === 0 ||
    authorSexFilter.some((filter: string) => {
      // There are some weird things happening when using getPlayInfo()
      // to get author sexes.
      // Seems to be an issue with the async nature of the function.
      // Array.prototype.some() cannot be used with an async function,
      // but even resolving all the promises with Promise.all
      // does not seem to work.
      // So let's use a sync function instead...
      const authorSex = getAuthorSex(play.authorId, play.lang);
      if (!authorSex) return;
      return (authorSex as string[]).some((sex: string) => sex === filter);
    });

    const langMatches = langFilter.length === 0 ||
    langFilter.some((filter: string) => filter === play.lang);

    const genreMatches = genreFilter.length === 0 ||
    genreFilter.some((filter: string) => {
      if (filterMappings.genre[filter] instanceof Array) {
        return filterMappings.genre[filter].some((genre: string) => genre === play.genre);
      } else {
        return filterMappings.genre[filter] === play.genre;
      }
    });

    const dateMatches = dateFilter.length === 0 ||
    dateFilter.some((filter: Array<number>) => {
      const printed = +play.printed;
      return (printed >= filter[0] && printed <= filter[1]);
    });

    const searchMatches = searchFilter.length === 0 ||
    play.titleMain.toLowerCase().includes(searchFilter.toLowerCase());

    return publisherMatches && authorMatches && authorSexMatches
    && langMatches && genreMatches && dateMatches && searchMatches;
  });

  totalShownPlayItems = filteredPlayData.length;

  return filteredPlayData;
}

/**
 * Updates the view based on the specified data type and filters.
 * @param entity - The type of entity to update the view with (either "characters" or "plays").
 * @param sharedProp - Indicates whether properties are shared between the entities.
 * @returns A Promise that resolves when the view is updated.
 */
async function updateView(entity: string, sharedProp = false) {
  let filteredData: Character[] | Play[];
  const isPlayFiltered = Object.values(playFilters).some((filter) => filter.length > 0);

  // as updateView is called every time a filter is disabled,
  // do a check to see if all filters are disabled
  // if so, we don't need to continue the filtering logic,
  // just reset the filters and show all data, as by default
  //
  // this also fixes an issue where the count of plays/characters
  // would be off compared to the total number of items,
  // because charsInPlays and playsWithChars are not necessarily
  // equal to charData.length and playData.length
  // (e.g. char_data.json does not contains all characters of
  // plays in play_data.json, and vice versa)
  if (Object.values(charFilters).every((filter) => filter.length === 0) &&
      Object.values(playFilters).every((filter) => filter.length === 0)) {
    resetFilters();
    return;
  }

  switch (entity) {
    case "characters":
      charCurrentPage = 1;

      if (isPlayFiltered) {
        filteredData = filterCharacters(filteredCharsInPlays);
      } else {
        filteredData = filterCharacters(charData);
      }

      $("#char-list").html("");
      $("#char-list-pagination").html("");

      if (filteredData.length <= itemsPerPage) {
        $("#char-list-show-all-btn").addClass("disabled");
      }
      renderData("main-view-chars", filteredData, charCurrentPage);

      if (!sharedProp) {
        showRelations("playsByChar", false, null, false, true);
      } else {
        updateView("plays", false);
      }

      break;
    case "plays":
      if (sharedProp) {
        return;
      }

      playCurrentPage = 1;
      if (charFilters.professionalGroup.length > 0 ||
        charFilters.socialClass.length > 0 ||
        charFilters.sex.length > 0) {
          filteredData = filterPlays(filteredPlaysWithChars);
        // }
      } else {
        filteredData = filterPlays(playData);
      }

      $("#play-list").html("");
      $("#play-list-pagination").html("");
      renderData("main-view-plays-table", filteredData, playCurrentPage);

      showRelations("charsByPlay", false, null, false, true);
      //! this was used so that if a play-specific filter was used,
      //! the character list would be updated accordingly
      //! when removing the filters
      //! but that's not a good way of doing it
      // if (playFilters.publisher.length > 0 || playFilters.author.length > 0 || playFilters.dates.length > 0 || playFilters.lang.length > 0) {
      //   showRelations("charsByPlay", false, null, false, true);
      // } else {
      //   $("#char-list").html(originalCharTemplate);
      // }

      // update highlight graph when using play-specific filter
      // (e.g. publisher, author, date)
      setGraphHighlight(filteredData, false);
      updateChart(getChartData(filteredData, currentGraphType, "playsByChar"));
      break;
  }

  updateProgress();
  $("#filter-reset-btn").removeClass("disabled");
};

/**
 * Resets the filters and restore UI to its default state.
 */
function resetFilters() : void {
  allCharsShown = false;

  // reset filter arrays
  // seems like we need to create new objects
  // for the arrays to be emptied correctly :(
  // not sure what's going on here
  charFilters = {
    lang: [],
    sex: [],
    professionalGroup: [],
    socialClass: [],
    searchInput: "",
  }
  playFilters = {
    publisher: [],
    lang: [],
    genre: [],
    author: [],
    sex: [],
    dates: [],
    searchInput: "",
  }

  $("#char-list").html(originalCharTemplate);
  $("#play-list").html(originalPlayTemplate);

  // reset play-header-text if in "[char] appears in" view
  $(".play-header-text").text("Plays")
  .next().css("display", "inline"); // show progress number again
  $(".header-info[name='header-info-play']").css("display", "flex"); // show header info again

  $("#filter-reset-btn").addClass("disabled");
  $(`.char-list-show-play-unique-btn,
  play-list-show-char-unique-btn,
  .filter-btn`).removeClass("active");

  // reset all pagination values except first page
  // do not one-line, breaks otherwise
  $("#char-list-pagination").find("option").not(":first").remove();
  $("#play-list-pagination").find("option").not(":first").remove();

  $("#char-list-show-all-btn").removeClass("disabled");
  $(".resize, .brush, .pane").removeClass("tl-disabled");

  totalShownCharItems = charData.length;
  totalShownPlayItems = playData.length;
  filteredCharData = charData;
  filteredPlayData = playData;
  charCurrentPage = 1;
  playCurrentPage = 1;

  updateProgress();

  clearGraphHighlight(true); // reset highlight and brush
  setGraphHighlight(playData); // reset timeline plot to default

  // reset chart to default in current selected view
  const chartData = currentGraphType === "charGender" ?
  getChartData(charData, currentGraphType, "charsByPlay") :
  getChartData(playData, currentGraphType);

  //updateChart(chartData);
  drawChart(chartData, currentGraphType);

  // reset selects data
  // @ts-ignore
  const authorSelect = document.getElementById("select-author").tomselect;
  // @ts-ignore
  const pubSelect = document.getElementById("select-pub").tomselect;

  const objectMap = (obj, fn) =>
  Object.fromEntries(
    Object.entries(obj).map(
      ([k, v], i) => [k, fn(v, k, i)]
    )
  );

  const updatedAuthorSelectOptObj = objectMap(authorSelectData, (option, key) => {
    const newCount = authorSelectData[key].text.split(" (")[1].split(")")[0];
    const newText = authorSelectData[key].text.split(" (")[0] + " (" + newCount + ")";
    return { ...option, text: newText };
  });

  const updatedPubSelectOptObj = objectMap(pubSelectData, (option, key) => {
    const newCount = pubSelectData[key].text.split(" (")[1].split(")")[0];
    const newText = pubSelectData[key].text.split(" (")[0] + " (" + newCount + ")";
    return { ...option, text: newText };
  });

  authorSelect.options = updatedAuthorSelectOptObj;
  pubSelect.options = updatedPubSelectOptObj;
};

/**
 * Updates entity progress numbers and scrolls to the top of each entity view.
 */
function updateProgress() : void {
  preventScrollEvent = true;
  $(".main-view-chars, .main-view-plays-table").scrollTop(0);
  preventScrollEvent = false;

  $(".char-progress").text(`${totalShownCharItems}`);
  $(".play-progress").text(`${totalShownPlayItems}`);
}

/**
 * Displays relations based on the specified view mode, uniqueness, entity, and other options.
 * @param viewMode - The mode in which the relations are displayed.
 * @param unique - A boolean indicating whether the relations should be unique or not.
 * @param entity - The entity (Character or Play) for which the relations are displayed.
 * @param appendNames - A boolean indicating whether to append names.
 * @param useFilters - A boolean indicating whether to use filters when displaying relations.
 * @returns A Promise that resolves when the relations are displayed.
 */
async function showRelations(viewMode: string, unique: boolean, entity: Character | Play = null, appendNames = false, useFilters = true) : Promise<void> {
  if (viewMode === "playsByChar") {
    const playsWithChars: Play[] = [];

    if (unique && entity !== null) {
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
        ...playData.find((play: Play) => play.workId === entity.workId && play.lang === entity.lang),
        characters: [entity as Character]
      });

      $(".play-header-text").html("<strong>" + (entity as Character).persName +
      "</strong> appears in:");

      $(".play-header-text").next().css("display", "none") // hide progress number
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

    // save a copy of the data only if we're not using magnifier mode
    // we need to do that to execute setGraphHighlight(filteredPlayData)
    // and go back to the previous graph view
    if (playsWithChars.length > 1) {
      filteredPlayData = playsWithChars;
    }

    if (Object.values(playFilters).some((filter) => filter.length > 0)
    || Object.values(charFilters).some((filter) => filter.length > 0)) {
      filteredPlaysWithChars = playsWithChars;
    }

    totalShownPlayItems = playsWithChars.length;

    let playTemplate: string;
    // unique of generatePlayTemplate() must be true
    // when char-list-show-play-unique-btn is clicked
    // this way, the previous template is saved
    // as currentPlayTemplate in generatePlayTemplate()
    // and the user can go back to the previous view
    // by clicking on the show-play-btn again
    if (appendNames || unique) {
      playTemplate = await generatePlayTemplate(playsWithChars, true);
    } else {
      playTemplate = await generatePlayTemplate(playsWithChars, false);
    }

    // fix anchor not appearing when filtering by char-specific filter
    if (playTemplate &&
        !playTemplate.includes(`<div id="play-p-1"><span class="page-circle">1</span></div>`) &&
        // except in magnifier view
        !unique) {
      playTemplate = `<div id="play-p-1"><span class="page-circle">1</span></div>` + playTemplate;
    }

    $("#play-list").html(playTemplate);

    // only highlight graph if filtered
    if (totalShownPlayItems !== playData.length) {
      setGraphHighlight(playsWithChars, unique);

      // don't update chart nor selects if we're using magnifier mode
      if (!unique) {
        updateChart(getChartData(playsWithChars, currentGraphType, viewMode));
        updateCreatorSelects();
      }
    }

  } else if (viewMode === "charsByPlay") {
    const charsInPlays: Character[] = [];

    if (unique && entity !== null) {
      const matchingChars = charData.filter((char: Character) =>
        char.workId === entity.workId && char.lang === entity.lang);

      charsInPlays.push(...matchingChars.map((matchingChar) => ({
        ...matchingChar,
        play: entity as Play
      })));

      $(".char-header-text").html(`Characters in
      <i><strong>${(entity as Play).titleMain}</strong></i>
      (${charsInPlays.length})`)

      $(".char-header-text").next().css("display", "none") // hide progress number

      // hide header info
      $(".header-info[name='header-info-char']").css("display", "none");
    } else {
      // take into account char filters when filtering
      if (useFilters) {
        filteredPlayData.forEach((play: Play) => {
          let filteredData = null;
          filteredData = charData.filter((char: Character) => char.workId === play.workId && char.lang === play.lang)
          filteredData = filterCharacters(filteredData);
          filteredData.forEach((char: Character) => {
            charsInPlays.push(char);
          });
        });
      } else {
        filteredPlayData.forEach((play: Play) => {
          charData.filter((char: Character) => char.workId === play.workId && char.lang === play.lang)
          .forEach((char: Character) => {
            charsInPlays.push(char);
          });
        });
      }
    };

    // This creates an explicit, global copy
    // of the charsInPlays array when data is filtered by
    // play-specific filters (dates, author, publisher, genre).
    // We need to have a copy available
    // to do further char-specific (gender; prof; class) filtering
    // on already play-filtered characters.
    //
    // That copy is subsequently used in updateView().
    //
    // Otherwise, applying a play-specific filter would reset the character data.
    // There may be a better way to do this, improve later if enough time.
    const isFiltered = Object.values(playFilters).some((filter) => filter.length > 0);
    if (isFiltered) {
      filteredCharsInPlays = charsInPlays;
    }

    totalShownCharItems = charsInPlays.length;

    let charTemplate;
    if (appendNames || unique) {
      charTemplate = await generateCharacterTemplate(charsInPlays, true, false, true);
    } else {
      charTemplate = await generateCharacterTemplate(charsInPlays, true, false, false);
    }

    $("#char-list").html(charTemplate);
  }
};

/**
 * Sets the graph highlight based on the provided data.
 * @param data - The array of Play objects.
 * @param highlightUnique - Optional. Indicates whether to highlight a unique period. Default is false.
 */
function setGraphHighlight(data: Play[], highlightUnique = false) {
  clearGraphHighlight();

  if (highlightUnique) {
    const yearPair = getYearPair(data);
    highlightGraphPeriod(yearPair["year1"], yearPair["year2"], yearPair["lang"]);
    return;
  }
  const dataCount = getDataCountByYear(data);
  updateTimelineLangPlot(dataCount);

  // raises handles svgs
  // fixes problem with svg layering order,
  // as highlight would be on top of handles,
  // which would make it impossible to drag the handles
  raiseHandles();
};

/**
 * Retrieves the chart data based on the provided parameters.
 * @param data - Optional. The data to be used for generating the chart. Defaults to filteredPlayData.
 * @param chartType - Optional. The type of chart to be generated. Defaults to "authorGender".
 * @param viewMode - Optional. The view mode for the chart. Defaults to null.
 * @returns The chart data.
 */
function getChartData(data: Play[] | Character[] = filteredPlayData, chartType: string = "authorGender", viewMode = null) {
  let minPlayDataYear, maxPlayDataYear: number;

  // if getChartData() is called from showRelations() w/ viewMode "playsByChar"
  // and we want to show a char-specific chart (e.g. charGender),
  // data needs to be replaced with filteredCharData
  // so that only data from the filtered characters is used in the chart
  // otherwise, data is a Play[] because we're passing playsWithChars Play[]
  // (which is used for play-specific charts, e.g. authorGender)
  // changing the type of data accordingly
  // will also enable us to get the correct min and max years for plays later on
  if (viewMode === "playsByChar" && chartType === "charGender") {
    data = filteredCharsInPlays.length === totalShownCharItems ? filteredCharsInPlays : filteredCharData;
  }

  if (chartType === "charGender") {
    const getPlay = (char: Character): Play => {
      return playData.find((play: Play) =>
        play.workId === char.workId && play.lang === char.lang);
    };
    const plays = (data as Character[]).map((char: Character) => getPlay(char));
    [minPlayDataYear, maxPlayDataYear] = getMinMaxPlayDataYear(plays);
  } else {
    [minPlayDataYear, maxPlayDataYear] = getMinMaxPlayDataYear(data as Play[]);
  }

  // array used to generate data with zero values for years with no data
  // so that the chart graph can be generated correctly
  const allYears = Array.from({ length: maxPlayDataYear - minPlayDataYear + 1 },
    (_, i) => i + minPlayDataYear);

  let chartData = null;
  //todo: refactor this, ugly!
  if (chartType === "authorGender") {
    const authorGenderData: { [key: number]:
      { M: number; F: number, U: number } } = {};

    // get number of plays over time with male or female authors
    (data as Play[]).forEach((play: Play) => {
      const { lang, printed } = play;

      if (printed === null || Number.isNaN(Number(printed))) return;

      const authorIds = Array.isArray(play.authorId)
      ? play.authorId : [play.authorId];

      authorIds.forEach((authorId: number) => {
        const author = authorData.find((author: Author) =>
        author.authorId === authorId && author.lang === lang);

        if (author && author.sex) {
          if (!authorGenderData[printed]) {
            authorGenderData[printed] = { M: 0, F: 0, U: 0 };
          }

          authorGenderData[printed][author.sex === "M" ? "M"
          : author.sex === "F" ? "F"
          : author.sex === "U" ? "U" : ""]++;
        }
      });
    })

    chartData = allYears.map(year => {
      const yearData = authorGenderData[year] || { M: 0, F: 0, U: 0 };
      return {
        // convert to date object for D3
        year: new Date(year, 0, 1),
        ...yearData
      }
    })
  } else if (chartType === "charGender") {
    const charGenderData: { [key: number]: { M: number; F: number,
      U: number, B: number } } = {};

    (data as Character[]).forEach((char: Character) => {
      const play = playData.find((play: Play) =>
        play.workId === char.workId && play.lang === char.lang);

      if (play) {
        const { printed } = play;

        if (printed === null || Number.isNaN(Number(printed))) return;

        if (!charGenderData[printed]) {
          charGenderData[printed] = { M: 0, F: 0, U: 0, B: 0 };
        }

        charGenderData[printed][char.sex === "M" ? "M"
        : char.sex === "F" ? "F"
        : char.sex === "U" ? "U"
        : char.sex === "B" ? "B" : ""]++;
      }
    })

    chartData = allYears.map(year => {
      const yearData = charGenderData[year] || { M: 0, F: 0, U: 0, B: 0 };
      return {
        // convert to date object for D3
        year: new Date(year, 0, 1),
        ...yearData
      }
    })
  } else if (chartType === "playGenre") {
    const genreData: { [key: number]: { [key: string]: number } } = {};
    const genreKeys = Object.keys(filterMappings.genre);

    (data as Play[]).forEach((play: Play) => {
      const { printed, genre } = play;

      if (printed === null || Number.isNaN(Number(printed))) return;

      if (!genreData[printed]) {
        genreData[printed] = genreKeys.reduce((acc, key) => {
          acc[key] = 0;
          return acc;
        }, {} as { [key: string]: number });
      }

      // associate genre to genreKey
      // so that array values in filterMappings.genre
      // get associated with the correct genre key
      genreKeys.forEach((genreKey: string) => {
        if (filterMappings.genre[genreKey] instanceof Array) {
          if (filterMappings.genre[genreKey].some((g: string) => g === genre)) {
            genreData[printed][genreKey]++;
          }
        } else {
          if (filterMappings.genre[genreKey] === genre) {
            genreData[printed][genreKey]++;
          }
        }
      });
    });

    chartData = allYears.map(year => {
      const yearData = genreData[year] || genreKeys.reduce((acc, key) => {
        acc[key] = 0;
        return acc;
      }, {} as { [key: string]: number });
      return {
        // convert to date object for D3
        year: new Date(year, 0, 1),
        ...yearData
      }
    })
  };

  return chartData;
};


/**
 * Switches the chart based on the given option.
 * @param option - The option to switch the chart.
 * @remark This function is here (and not in d3-charts.js) because
 * we need to get the data from here.
 * Unfortunately, exporting getChartData() to d3-charts.js
 * does not work as it calls the "on document ready" function
 * when importing getChartData,
 * causing data and other stuff to be loaded twice.
 */
function switchChart(option: string) : void {
  let data = null;

  switch (option) {
    case "authorGender":
      data = getChartData();
      break;
    case "charGender":
      data = getChartData(filteredCharData, "charGender", "playsByChar");
      break;
    case "playGenre":
      data = getChartData(filteredPlayData, "playGenre");
      break;
  }

  drawChart(data, option);
};

/**
 * Sets magnifier view for the specified entity type.
 * @param zoomOn - Entity type to zoom on ("characters" or "plays").
 * @param el - Clicked magnifier icon.
 */
async function setMagnifierView(zoomOn: string, el: JQuery<HTMLElement>): Promise<void> {
  const isActiveMagnifier = el.hasClass("active");
  const isChars = zoomOn === "characters";
  const isPlays = zoomOn === "plays";

  if (!isChars && !isPlays) {
    console.error("Unknown magnifier view:", zoomOn);
    return;
  }

  $(".char-list-show-play-unique-btn.active").removeClass("active");
  $(".play-list-show-char-unique-btn.active").removeClass("active");

  // logic executed when active magnifier icon is clicked
  if (isActiveMagnifier) {
    // disable active magnifier icon
    const magnifierBtnClass = isChars
      ? ".play-list-show-char-unique-btn"
      : ".char-list-show-play-unique-btn";
    $(magnifierBtnClass).removeClass("active");

    // reset view
    const listId = isChars ? "#char-list" : "#play-list";
    const currentTemplate = isChars ? currentCharTemplate : currentPlayTemplate;
    $(listId).html(currentTemplate);

    // find a better way for the second condition...
    if (isPlays && $(".char-header-text").text().includes("in")) {
      // if we're zooming on a play while characters have been zoomed on,
      // we need to keep the magnifier icon active for the play in which the character appears
      const playId = el.data("workid");
      const playMagnifierBtn = $(`.play-list-show-char-unique-btn[data-workid='${playId}']`);
      playMagnifierBtn.addClass("active");
    }

    // reset timeline
    setGraphHighlight(filteredPlayData, false);

    // reset header text
    const headerText = isChars ? ".char-header-text" : ".play-header-text";
    $(headerText)
      .text(isChars ? "Characters" : "Plays")
      .next()
      .css("display", "inline"); // show progress number again

    // reset header info
    const headerInfoName = isChars ? "header-info-char" : "header-info-play";
    $(`.header-info[name='${headerInfoName}']`).css("display", "flex");

    // reset total shown items
    totalShownCharItems = filteredCharData.length;
    totalShownPlayItems = filteredPlayData.length;

    // enable timeline again
    $(".resize, .brush, .pane").removeClass("tl-disabled");
    return;
  }

  const workId = el.data("workid");
  const lang = el.data("lang");
  const charId = el.data("charid");

  const entityType = isChars
    ? playData.find((play: Play) => play.workId === workId && play.lang === lang)
    : getCharacter(workId, lang, charId);

  const relationType = isChars ? "charsByPlay" : "playsByChar";
  showRelations(relationType, true, entityType);

  const otherMagnifierBtnClass = isChars
    ? ".char-list-show-play-unique-btn"
    : ".play-list-show-char-unique-btn";
  $(otherMagnifierBtnClass).removeClass("active");

  // enable magnifier icon
  $(el).addClass("active");

  // Disable timeline handles when using magnifier mode
  // since only one play/characters from one play are shown,
  // it doesn't make sense to have the handles enabled
  // plus, it would cause a bug where going beyond the play date
  // would render data as if magnifier mode were inactive
  $(".resize, .brush, .pane").addClass("tl-disabled");
}

/**
 * Displays the map overlay and sets up the map if it hasn't been set yet.
 */
async function showMap() : Promise<void> {
  $("#map-overlay").css("display", "flex");

  // map needs to be displayed for it to be set
  if (!isMapSet) {
    try {
      const publisherMapData = await getPublisherMapData();
      setMap(locData, settingData, publisherMapData, playData);
      isMapSet = true;
    } catch (error) {
      console.error("Error setting map:", error);
    }
  }
}

/**
 * Removes the hash from the current URL and updates the browser's current URL.
 */
function removeHashFromURL() {
  history.pushState("", document.title,
  window.location.pathname + window.location.search);
}

/**
 * Generates metadata in JSON format to be used by downloadData().
 */
function generateMetadata() : string {
  const playMetadata = playFilters;
  const charMetadata = charFilters;

  return JSON.stringify({ playMetadata, charMetadata }, null, 2);
}

/**
 * Downloads the filtered character data, play data, and metadata in JSON format as a ZIP file.
 */
async function downloadData() : Promise<void> {
  const charDataStr = JSON.stringify(filteredCharData, null, 2);
  const playDataStr = JSON.stringify(filteredPlayData, null, 2);
  const metadataStr = generateMetadata();

  const zip = new JSZip();
  zip.file("char_data.json", charDataStr);
  zip.file("play_data.json", playDataStr);
  zip.file("metadata.json", metadataStr);

  try {
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const currentTime = new Date().toISOString().replace(/:/g, "-");

    const link = document.createElement("a");
    link.href = url;
    link.download = `thealtres-vis-data-${currentTime}.zip`;
    link.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating ZIP file:", error);
  }
}

/**
 * Fetches data from multiple JSON files asynchronously.
 */
async function fetchData(): Promise<void> {
  try {
    const JSONFiles = ["/json/char_data.json", "/json/play_data.json",
                      "/json/author_data.json", "/json/publisher_data.json",
                      "/json/location_data.json", "/json/setting_data.json"];

    $("#loader").show();

    [charData, playData, authorData, publisherData, locData, settingData] = await Promise.all(
      JSONFiles.map(async (file: string) => {
        const {characters, plays, authors, publishers, locations, settings} = await getJSON(file);
        return characters || plays || authors || publishers || locations || settings;
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
};

/**
 * Draws the UI and initializes the necessary components and data.
 */
async function drawUI() : Promise<void> {
  timelineData = generateTimelineData(playData)
  setTimeline(timelineData);

  let debounceTimer: ReturnType<typeof setTimeout>;
  let observer = new MutationObserver(function(mutations) {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      mutations.forEach(function(mutation) {
        let [graphDateRangeStart, graphDateRangeEnd] = mutation.target.textContent.split(" - ");

        // if no end date is set, set it to the start date
        if (!graphDateRangeEnd) graphDateRangeEnd = graphDateRangeStart;

        playFilters.dates = [[+graphDateRangeStart, +graphDateRangeEnd]];
        updateView("plays", false);
      });
    }, 300);
  });

  observer.observe($("#displayDates")[0], { childList: true });

  // set timeline, chart
  setGraphHighlight(playData);
  setChart(getChartData(playData));

  totalShownCharItems = charData.length;
  totalShownPlayItems = playData.length;
  $(".char-progress").text(`${totalShownCharItems}`);
  $(".play-progress").text(`${totalShownPlayItems}`);

  loadedCharData = charData.slice(0, itemsPerPage);
  loadedPlayData = playData.slice(0, itemsPerPage);

  renderData("main-view-chars", loadedCharData, charCurrentPage);
  renderData("main-view-plays-table", loadedPlayData, playCurrentPage);

  // This JSON file is used to map values in charData and playData to:
  // 1) their full names to be shown as tooltips
  // (applies to charData lang, gender and socialClass; playData genre)
  // 2) their abbreviated values to be shown as buttons
  // as the original values would be too long to display
  // (applies to professionalGroup)
  filterMappings = await getJSON("/json/misc/filter_map.json");
  await fillFilterValues(filterMappings);

  enableFilterBtns();
  enableSortRows();

  originalCharTemplate = $("#char-list").html();
  originalPlayTemplate = $("#play-list").html();

  // @ts-ignore | initialize tooltips
  $("[rel=tooltip]").tooltip();

  // disable "Reset" button by default
  $("#filter-reset-btn")
  .addClass("disabled");

  // handle url hashes
  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    if (hash === "map") {
      showMap();
    }
    else if (hash === "info") {
      $("#info-overlay").css("display", "flex");
    }
  }
}

$(function () {
  fetchData();

  $("#filter-reset-btn").on("click", function() {
    if ($(this).hasClass("disabled")) {
      return;
    }

    resetFilters();
    updateProgress();
  });

  $("#char-list-show-all-btn").on("click", function() {
    if ($(this).hasClass("disabled")) {
      return;
    }

    showAllCharData();
    allCharsShown = true;
  });

  $("#char-list-pagination, #play-list-pagination").on("change", function(e) {
    const target = e.target as HTMLInputElement;
    const page = target.value.split("-")[2];
    const elName = target.id.split("-")[0];
    scrollToPageNumber(page, elName);
  });

  // needs to be done at document level
  // because the button is dynamically created
  $(document).on("click", ".char-list-show-play-unique-btn", function() {
    setMagnifierView("plays", $(this));
  });

  // needs to be done at document level
  // because the button is dynamically created
  $(document).on("click", ".play-list-show-char-unique-btn", async function() {
    setMagnifierView("characters", $(this));
  });

  $(".main-view-chars, .main-view-plays-table").on("scroll", function() {
    handleScroll(this, preventScrollEvent);
  });

  $("[id$=search-input]").on("input", function() {
    handleSearch(this as HTMLInputElement);
  });

  // @ts-ignore
  d3.select("#chart-select-btn").on("change", function() {
    // @ts-ignore
    currentGraphType = d3.select(this).property("value");
    switchChart(currentGraphType);
  });

  $("#map-open-btn").on("click", function() {
    showMap();
    window.location.hash = "map";
  });

  $("#info-open-btn").on("click", function() {
    $("#info-overlay").css("display", "flex");
    window.location.hash = "info";
  });

  $("#map-filter-window-close-btn").on("click", function() {
    $("#map-overlay").css("display", "none");
    removeHashFromURL();
  });

  document.addEventListener("click", function(e) {
    if ((e.target as HTMLElement).id === "info-overlay") {
      $("#info-overlay").css("display", "none");
      removeHashFromURL();
    }
  });

  $("#download-btn").on("click", function() {
    downloadData();
  })
});