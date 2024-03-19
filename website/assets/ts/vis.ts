import { Character, Play, Author, Publisher } from "./IEntity";
import { setTimeline, updateTimelineLangPlot,
  clearGraphHighlight, raiseHandles, highlightGraphPeriod } from "../js-plugins/d3-timeline";
import { drawChart, setChart, updateChart } from "../js-plugins/d3-charts";

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
const playFilterEls = {
  "genre": $("#filter-genre-values"),
}

let charData: Character[] = [], playData: Play[] = [],
authorData: Author[] = [], publisherData: Publisher[] = [];

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
  dates: [],
  searchInput: "",
};
let playFilters = defaultPlayFilters;

let originalCharTemplate: string, originalPlayTemplate: string;
let currentCharTemplate: string, currentPlayTemplate: string;

let totalShownCharItems = 0, totalShownPlayItems = 0;

let preventScrollEvent = false;

let timelineData = [];

let currentGraphType: string;

/* Pagination */
let playCurrentPage = 1;
let charCurrentPage = 1;
const itemsPerPage = 50;
let loadedCharData: Character[] = [];
let loadedPlayData: Play[] = [];

// FA icons used in table headers for sorting
const caretDownEl = `<i class="fa-solid fa-caret-down caret-force-visible"></i>`;
const caretUpEl = `<i class="fa-solid fa-caret-up caret-force-visible"></i>`;

let allCharsShown = false;

let isMapSet = false;

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
function getDataCountByYear(data: Play[]) {
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
}

function getYearPair(data: Play[]) {
  console.log(data)
  return data.map((item: Play) => {
    return {
      year1: +item.printed,
      year2: +item.printed + 1,
      lang: item.lang
    };
  }).filter(y => y.year1 !== 0 && !isNaN(y.year1))
  .reduce((acc, curr) => ({ ...acc, ...curr }), {});
}

function getMinMaxPlayDataYear(data: Play[]) : number[] {
  const minYear = Math.min(...data.map((item: Play) => +item.printed)
  .filter(year => !isNaN(year) && year !== 0));
  const maxYear = Math.max(...data.map((item: Play) => +item.printed)
  .filter(year => !isNaN(year)));

  return [minYear, maxYear];
}

function findSuccessiveYears(years) : object {
  const sortedDates = years.sort((a, b) => a.year - b.year);
  const ranges = {}; // { range1: [1824, 1825, 1826], range2: [1830, 1831] }
  let currentRange = [];

  console.log("sortedDates", filteredCharData, filteredPlayData, totalShownCharItems, totalShownPlayItems)

  for (let i = 0; i < sortedDates.length; i++) {
    const currentDate = sortedDates[i];

    if (i === 0 || currentDate !== sortedDates[i - 1] + 1) {
      if (currentRange.length > 0) {
        // check if range has only one date
        // we need one beginning and one end date to create the highlight rect
        if (currentRange.length === 1) {
            currentRange.push({
              year: currentRange[0].year + 1,
              lang: currentRange[0].lang
          });
        }

        ranges[`range${Object.keys(ranges).length + 1}`] = {
          lang: currentRange[0].lang,
          years: currentRange.map(y => y.year)
        };
      }
      currentRange = [currentDate];
      } else {
        currentRange.push(currentDate);
      }
    }

  console.log("currentRange0", currentRange)

  let noDateRange = null;
  if (currentRange.length === 0) {
    noDateRange = true;
    // add last range
  } else if (currentRange.length > 0) {
    noDateRange = false;
// check if range has only one date
    // we need one beginning and one end date to create the highlight rect
    if (currentRange.length === 1) {
      currentRange.push({
        year: currentRange[0].year + 1,
        lang: currentRange[0].lang
      });
    }
    // // check if range has only one date
    // // we need one beginning and one end date to create the highlight rect
    // if (currentRange.length === 1) {
    //   currentRange.push(currentRange[0] + 1);
    // }
    // ranges[`range${Object.keys(ranges).length + 1}`] = currentRange;
    ranges[`range${Object.keys(ranges).length + 1}`] = {
      lang: currentRange[0].lang,
      years: currentRange.map(y => y.year)
    };
  }

  console.log("ranges", ranges)

  return ranges;
}

async function renderData(elName: string, loadedData: Character[] | Play[], currentPage: number) {
  if ($("g.context").find("rect.highlight-rect").length > 0
      // only clear if we're on the first page
      // otherwise, caused the highlight to be cleared when scrolling
      && currentPage === 1) {
  }

  if (loadedData.length === 0) {
    if (elName === "main-view-chars") {
      $("#char-list").html("<p>No characters found</p>");
      $("#char-list-sort-btn").addClass("disabled");
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
    anchorEl = `<p id="char-p-${currentPage}">Page ${currentPage}</p>`
  } else if (elName === "main-view-plays-table" && filteredPlayData.length > itemsPerPage) {
    anchorEl = `<span id="play-p-${currentPage}">Page ${currentPage}</span>`
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
}

async function showAllCharData() {
  if (allCharsShown) {
    return;
  }

  const template = await generateCharacterTemplate(charData);
  $("#char-list").html(template);
  $("#char-list-pagination").remove();
  $("#char-list-show-all-btn").addClass("disabled");
  $("#filter-reset-btn").removeClass("disabled");
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

function scrollToPageNumber(pageNumber: string, type: string): void {
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
}

/**
 * Enable sort rows feature
 * Modified from https://stackoverflow.com/questions/3160277/jquery-table-sort
 */
function enableSortRows() {
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
   * Compare rows
   * @param index - Index of the column to sort by
   * @returns - Comparator function to sort rows by index column
   */
  function comparer(index: number) {
    /**
     * Get cell value
     * @param row - Row to get value from
     * @param index - Index of the column to get value from
     * @returns {string}
     */
    function getCellValue(row: HTMLTableCellElement, index: number) {
      return $(row).children("td").eq(index).text();
    }

    /**
     * @param n - Number or string to check
     * @returns - Whether n is a number or string; and is finite
     */
    function isNumeric(n: number | string) {
      return !isNaN(parseFloat(n as string)) && isFinite(n as number);
    }

    return function(a: HTMLTableCellElement, b: HTMLTableCellElement) {
      const valA = getCellValue(a, index);
      const valB = getCellValue(b, index);
      return isNumeric(valA) && isNumeric(valB) ? parseInt(valA) - parseInt(valB)
      : valA.toString().localeCompare(valB);
    };
  }
}

/**
 * Create an object with the count of each year in the data
 * to be used to generate the D3.js timeline
 * @param data - array of plays
 * @returns - array of objects with year and count properties
 */
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

async function fillFilterValues(dataType: string, filterMappings): Promise<void> {
  // This JSON file is used to map values in charData and playData to:
  // 1) their full names to be shown as tooltips
  // (applies to charData lang, gender and socialClass; playData genre)
  // 2) their abbreviated values to be shown as buttons
  // as the original values would be too long to display
  // (applies to professionalGroup)
  console.log(filterMappings["sex"])

  switch (dataType) {
    case "plays":
      fillSelect("publisher", "#select-pub");
      fillSelect("author", "#select-author");

      for (const key in playFilterEls) {
        const values = new Set(playData.map((play: Play) => play[key]));
        console.log(filterMappings[key])

        const select = playFilterEls[key];
        values.forEach((value : string) => {
          const option = document.createElement("button");
          option.name = key;
          option.textContent = filterMappings[key][value];
          $(option).addClass("filter-btn");
          select.append(option);
        });
      }
      break;
    case "characters":
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
    }
}

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
      console.log("headerText", headerText)
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
      } else if (key === "sex" || key === "professionalGroup" || key === "socialClass") {
        charFilters[key] = charFilters[key].filter(item => item !== value);
        updateView("characters");
      } else if (key === "genre") {
        playFilters[key] = playFilters[key].filter(item => item !== value);
        updateView("plays");
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
      } else if (key === "genre") {
        playFilters[key].push(value);
        updateView("plays");
      }
    }

    updateProgress();
  });
}

function fillSelect(dataType: string, selectId: string) {
  let data: { value: number, text: string }[];

  switch (dataType) {
    case "publisher":
      data = publisherData
      .map((publisher: Publisher) => ({
        value: publisher.publisherId,
        // some publisher values have no normalizedName
        text: (publisher.normalizedName ?? publisher.nameOnPlay) +" (" +
        getNumberOfPlaysByIdAndLang(playData, publisher.publisherId, publisher.lang, "publisher") + ")"
      }))
      break;
    case "author":
      data = authorData.map((author: Author) => ({
        value: author.authorId,
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
      updateProgress();
    },
    onItemRemove: (id: string) => {
      playFilters[dataType] = playFilters[dataType].filter(item => item !== id);
      updateView("plays", false);
      updateProgress();
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

function updateSelectOption(selectId: string, optionValue: number, includeCount = false, newCount: number = 0) {
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

// function updateCreatorSelectOptionObjs(selectEl) {
//   let selectData = selectEl.id === "select-author" ?
//   authorSelectData : pubSelectData;

//   // https://stackoverflow.com/a/14810722/6479579
//   const objectMap = (obj, fn) =>
//   Object.fromEntries(
//     Object.entries(obj).map(
//       ([k, v], i) => [k, fn(v, k, i)]
//     )
//   );

//   const updatedSelectObj = objectMap(selectData, (option, key) => {
//     const newCount = selectData[key].text.split(" (")[1].split(")")[0];
//     const newText = selectData[key].text.split(" (")[0] + " (" + newCount + ")";
//     return { ...option, text: newText };
//   });

//   selectEl.options = updatedSelectObj;
// }

function updateCreatorSelects(filteredData: Play[]) {
  authorData.forEach((author: Author) => {
    updateSelectOption("select-author", author.authorId,
    //! getNumberOfPlaysByIdAndLang is broken; sometimes returns zero when filtering :(
    //! temp fix: hide count when filtering
    //getNumberOfPlaysByIdAndLang(filteredData, author.authorId, author.lang, "author"));
    false);
  });

  publisherData.forEach((publisher: Publisher) => {
    updateSelectOption("select-pub", publisher.publisherId,
    //getNumberOfPlaysByIdAndLang(filteredData, publisher.publisherId, publisher.lang, "publisher"));
    false);
  });
};

async function generateCharacterTemplate(data: Character[], showPlayBtn = true, minified = false, charsInPlay = false): Promise<string> {
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
      let date = await getPlayInfo(workId, lang, "playObject")
      .then((play: Play) => { return play.printed; }) ?? "";

      if (minified) {
        return `<p class="char-minified">${name}</p>`;
      }

      let charText = [name, sex, socialClass, profession, date]
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
          <th scope="col">Soc. Class<br>${caretDownEl} ${caretUpEl}</th>
          <th scope="col">Profession<br>${caretDownEl} ${caretUpEl}</th>
          <th scope="col">Date<br>${caretDownEl} ${caretUpEl}</th>
          <th scope="col"></th>
          </tr></thead>` + html;
        }
      }

      // highlight unique characters the same color as rect in highlight graph
      if (charPromises.length === 1
        // only when clicking show-play-unique-btn
        // otherwise, triggers when clicking the char-list-show-plays-btn
        // when only one char is returned for a play
        //  ???
        && $(".char-list-show-play-unique-btn").filter((i, el) =>
        $(el).hasClass("active")).length > 0) {
          html = html.replace("<p class=\"char-minified\">",
          "<p class=\"char-minified unique\">");
        }

        if (!charsInPlay) {
          currentCharTemplate = `<span id="char-p-1">Page 1</span>` + html;
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
      const date = play.printed ?? "";
      const authorName = await getPlayInfo(play.authorId, play.lang, "author");
      const genre = play.genre;

      const capitalizedGenre = genre ? genre.charAt(0).toUpperCase() + play.genre.slice(1) : "";

      let titleMainDated = titleMain.trim();
      if (date) {
        titleMainDated += ` (${date})`;
      }

      // filter out empty values
      let playText = [titleMainDated, authorName, capitalizedGenre].filter(Boolean).join("<br>");

      if (charsInPlayCard) {
        // do not include char-list-show-play-unique-btn search icon
        // when adding chars to play card
        // this creates side effects when using both magnifier modes;
        // may fix later
        playText += await generateCharacterTemplate(play.characters, false, true, true);
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
    // from showRelations() (i.e. charsInPlayCard is false)
    // so that we can show all previously shown plays when clicking
    // the char-list-show-play-unique-btn search icon again
    if (!charsInPlayCard) {
      // there is a bug that causes "Page 1" not to be saved in the html
      // when clicking the char-list-show-play-unique-btn search icon again
      // to disable the "[char] appears in" view
      // may be caused by the fact that the "Page 1" string
      // is not part of the html generated for the "[char] appears in" view
      const spanPageEl = `<span id="play-p-1">Page 1</span>`;
      currentPlayTemplate = spanPageEl + html;
    }

    console.log('html', html)
    console.log('currentPlayTemplate', currentPlayTemplate)

    return html;
  } catch (error) {
    console.error("Error generating play template:", error);
    return "";
  }
}

async function getPlayInfo(id: number | number[], lang: string, type: string) : Promise<string|number|Play> {
  //console.time("getPlayInfo")
  if (id === undefined) {
    return "Unknown";
  }

  switch (type) {
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
        console.error("Error getting play info for type 'author':", error);
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

function getCharacter(workId: number, lang: string, charId: number) : Character {
  return charData.find((char: Character) =>
    char.workId === workId && char.lang === lang && char.characterId === charId
  );
}

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
        parseInt(play.publisherId) === id && play.lang === lang).length;
  }
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
  const genreFilter = playFilters.genre;
  const dateFilter = playFilters.dates;

  filteredPlayData = playData.filter((play: Play) => {
    const publisherMatches = publisherFilter.length === 0 ||
    publisherFilter.some((filter: string) => {
      const matchingPublisher = play.publisherId === filter;

      if (matchingPublisher) {
        const publisher = publisherData.find((publisher: Publisher) =>
            publisher.publisherId === parseInt(filter)
        );

        return publisher && publisher.lang === play.lang;
      }
    });

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

    const genreMatches = genreFilter.length === 0 ||
    genreFilter.some((filter: string) => filter === play.genre);

    const dateMatches = dateFilter.length === 0 ||
    dateFilter.some((filter: Array<number>) => {
      const printed = +play.printed;
      return (printed >= filter[0] && printed <= filter[1]);
    });

    return publisherMatches && authorMatches && langMatches
    && genreMatches && dateMatches;
  });

  totalShownPlayItems = filteredPlayData.length;

  //console.timeEnd("filterPlays");
  return filteredPlayData;
}

async function updateView(dataType: string, sharedProp = false) {
  let filteredData: Character[] | Play[];
  console.log(`function updateView() called with args: ${dataType}, sharedProp=${sharedProp}`)

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
    console.log("all filters disabled")
    resetFilters();
    return;
  }

  switch (dataType) {
    case "characters":
      charCurrentPage = 1;
      //console.log("charData", charData)
      //console.log("filteredCharData", filteredCharData)

      const isFiltered = ["dates", "publisher", "author", "genre"].some(filter => playFilters[filter].length > 0);
      if (isFiltered) {
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

      // if ((!sharedProp) || sharedProp && (charFilters.sex.length > 0 || charFilters.professionalGroup.length > 0 || charFilters.socialClass.length > 0)) {
      //   showRelations("playsByChar", false);
      // } else {
      //   $("#play-list").html(originalPlayTemplate);
      // }
      //!
      if (!sharedProp) {
        showRelations("playsByChar", false, null, false);
      } else {
        updateView("plays", false);
      }

      break;
    case "plays":
      //! not sure about this
      // if ((sharedProp) || sharedProp && (charFilters.sex.length < 0 || charFilters.professionalGroup.length < 0 || charFilters.socialClass.length < 0)) {
      if (sharedProp) {
        console.log("returning, sharedProp", sharedProp, charFilters)
        return;
      }

      playCurrentPage = 1;
      if (charFilters.professionalGroup.length > 0 ||
        charFilters.socialClass.length > 0 ||
        charFilters.sex.length > 0) {
          console.log("filteredPlaysWithChars", filteredPlaysWithChars)
          console.log("cF", charFilters)
        filteredData = filterPlays(filteredPlaysWithChars);
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
      updateChart(getChartData(filteredData, currentGraphType));
      break;
  }

  $("#filter-reset-btn").removeClass("disabled");
};

function resetFilters() {
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

  clearGraphHighlight(true); // reset highlight and brush
  setGraphHighlight(playData); // reset timeline plot to default

  // reset chart to default in current selected view
  // currentGraphType will be undefined if graph type has not been changed
  // so using authorGender, because it's the default graph type
  const chartData = (currentGraphType === undefined || currentGraphType === "authorGender")
  ? getChartData(playData, "authorGender") : getChartData(charData, "charGender");

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

function updateProgress() {
  preventScrollEvent = true;
  $(".main-view-chars, .main-view-plays-table").scrollTop(0);
  preventScrollEvent = false;

  $(".char-progress").text(`${totalShownCharItems}`);
  $(".play-progress").text(`${totalShownPlayItems}`);
}

async function showRelations(viewMode: string, unique: boolean, entity: Character | Play = null, appendNames = false, useFilters = true) : Promise<void> {
  console.log("showRelations() called with args:", viewMode, unique, entity, appendNames)

  //console.time("showRelations");
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

    if (charFilters.professionalGroup.length > 0 ||
      charFilters.socialClass.length > 0 ||
      charFilters.sex.length > 0) {
      filteredPlaysWithChars = playsWithChars;
    }

    totalShownPlayItems = playsWithChars.length;

    let playTemplate: string;
    // charsInPlayCard of generatePlayTemplate() must be true
    // when char-list-show-play-unique-btn is clicked
    // this way, the previous template is saved
    // as currentPlayTemplate in generatePlayTemplate()
    // and the user can go back to the previous view
    // by clicking on the show-play-btn again
    if (appendNames || unique) {
      playTemplate = await generatePlayTemplate(playsWithChars, true);
    } else {      console.log("test2")
      playTemplate = await generatePlayTemplate(playsWithChars, false);
    }

    // fix anchor not appearing when filtering by char-specific filter
    if (playTemplate &&
        !playTemplate.includes(`<span id="play-p-1">Page 1</span>`) &&
        // except in magnifier view
        !unique) {
      playTemplate = `<span id="play-p-1">Page 1</span>` + playTemplate;
    }

    $("#play-list").html(playTemplate);

    // only highlight graph if filtered
    if (totalShownPlayItems !== playData.length) {
      setGraphHighlight(playsWithChars, unique);

      // don't update chart nor selects if we're using magnifier mode
      if (!unique) {
        updateChart(getChartData(playsWithChars, currentGraphType, viewMode));
        updateCreatorSelects(playsWithChars);
      }
    }

  } else if (viewMode === "charsByPlay") {
    const charsInPlays: Character[] = [];

    //console.log(entity.workId, entity.lang)

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
    const isFiltered = ["dates", "publisher", "author", "genre"].some(filter => playFilters[filter].length > 0);
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

function setGraphHighlight(data: Play[], highlightUnique = false) {
  console.log(`calling setGraphHighlight with highlightUnique=${highlightUnique}`)
  console.log("data", data)
  clearGraphHighlight();

  if (highlightUnique) {
    const yearPair = getYearPair(data);
    console.log(yearPair)
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

function getChartData(data: Play[] | Character[] = filteredPlayData, chartType: string = "authorGender", viewMode = null) {
  console.log(`calling getChartData with chartType=${chartType}`)
  console.log("dLength", data.length, Object.keys(data[0]).length, data)
  console.trace()
  console.log("data", data)

  let minPlayDataYear, maxPlayDataYear: number;

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

  // if getChartData() is called from showRelations() w/ viewMode "playsByChar"
  // and we want to show a char-specific chart (e.g. charGender),
  // data needs to be replaced with filteredCharData
  // so that only data from the filtered characters is used in the chart
  // otherwise, data is a Play[] because we're passing playsWithChars Play[]
  // (which is used for play-specific charts, e.g. authorGender)
  // also, this check is done here and not before in the function
  // because we still need to pass Play[] to getMinMaxPlayDataYear()
  if (viewMode === "playsByChar" && chartType === "charGender") {
    data = filteredCharData;
  }

  console.log("filteredCharDataLength", filteredCharData.length)
  console.log("charsInPlaysLength", filteredCharsInPlays.length)

  // array used to generate data with zero values for years with no data
  // so that the chart graph can be generated correctly
  const allYears = Array.from({ length: maxPlayDataYear - minPlayDataYear + 1 },
    (_, i) => i + minPlayDataYear);

  let chartData = null;
  if (chartType === "authorGender") {
    const authorGenderData: { [key: number]:
      { M: number; F: number, U: number } } = {};

    // get number of plays over time with male or female authors
    data.forEach((play: Play) => {
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

    data.forEach((char: Character) => {
      const play = playData.find((play: Play) =>
        play.workId === char.workId && play.lang === char.lang);

      if (play) {
        const { lang, printed } = play;

        if (printed === null || Number.isNaN(Number(printed))) return;

        if (!charGenderData[printed]) {
          charGenderData[printed] = { M: 0, F: 0, U: 0, B: 0 };
        }

        charGenderData[printed][char.sex === "M" ? "M"
        : char.sex === "F" ? "F"
        : char.sex === "U" ? "U"
        : char.sex === "B" ? "B" : ""]++;
      }
    });

    console.log("charGenderData", charGenderData)

    chartData = allYears.map(year => {
      const yearData = charGenderData[year] || { M: 0, F: 0, U: 0, B: 0 };
      return {
        // convert to date object for D3
        year: new Date(year, 0, 1),
        ...yearData
      }
    })
  };

  console.log("chartData", chartData)

  return chartData;
};

// this function is here (and not in d3-charts.js) because
// we need to get the data from here
// unfortunately exporting getChartData() to d3-charts.js
// does not work as it calls the "on document ready" function
// when importing getChartData,
// causing data and other stuff to be loaded twice
function switchChart(option: string) {
  console.log(`calling switchChart with option=${option}`)
  let data = null;

  switch (option) {
    case "authorGender":
      console.log("dLength — calling getChartData with option authorGender")
      data = getChartData();
      break;
    case "charGender":
      console.log("dLength — calling getChartData with option charGender", filteredCharData.length)
      data = getChartData(filteredCharData, "charGender");
      break;
  }

  drawChart(data, option);
};

/**
 *
 * @param zoomOn - Entity type to zoom on ("characters" or "plays")
 * @param el - Clicked magnifier icon
 */
async function setMagnifierView(zoomOn: string, el: JQuery<HTMLElement>): Promise<void> {
  const isActiveMagnifier = el.hasClass("active");
  const isChars = zoomOn === "characters";
  const isPlays = zoomOn === "plays";

  if (!isChars && !isPlays) {
    console.error("Unknown magnifier view:", zoomOn);
    return;
  }

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

function setMap() {
  let map = L.map('map').setView([51.505, -0.09], 13);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  map.invalidateSize(true);
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
        updateProgress();
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

  const filterMappings = await getJSON("/json/misc/filter_map.json");
  await fillFilterValues("characters", filterMappings);
  await fillFilterValues("plays", filterMappings);

  enableFilterBtns();
  enableSortRows();

  originalCharTemplate = $("#char-list").html();
  originalPlayTemplate = $("#play-list").html();

  // @ts-ignore | initialize tooltips
  $("[rel=tooltip]").tooltip();

  // disable "Reset" button by default
  $("#filter-reset-btn")
  .addClass("disabled");
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

  d3.select("#chartSelectBtn").on("change", function() {
    currentGraphType = d3.select(this).property("value");
    switchChart(currentGraphType);
  });

  $("#map-open-btn").on("click", function() {
    $("#map-overlay").css("display", "flex");

    // map needs to be displayed for it to be set
    if (!isMapSet) {
      setMap();
      isMapSet = true;
    }
  });

  document.addEventListener("click", function(e) {
    if ((e.target as HTMLElement).id === "map-overlay") {
      $("#map-overlay").css("display", "none");
    }
  });
});