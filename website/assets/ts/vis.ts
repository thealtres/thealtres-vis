import { get } from "jquery";
import { Character, Play } from "./IEntity";

function getJSON(path: string) : Promise<any> {
  /* Used to get JSON data from a file */
  return new Promise((resolve, reject) => {
    $.ajax({
      url: path,
      method: "GET",
      dataType: "json",
      beforeSend: () => {
        $('#loader').show();
      },
      complete: () => {
        $('#loader').hide();
      },
      success: (data) => {
        resolve(data);
      },
      error: (jqXHR, textStatus, errorThrown) => {
        reject(errorThrown);
      }
    });
  });
};

function generateCharacterTemplate(data: any): string {
  var html = "<ul>";
  $.each(data, function (index, character: Character) {
    html += `<li>${character.persName}</li>`;
  });
  html += "</ul>";

  return html;
}

async function generatePlayTemplate(data: any): Promise<string> {
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
      console.log(authorId, authorName);
      //const publisher = getPlayInfo(play["publisher"], "publisher");
      return `<div class='play-card'><p>${titleMain}<br>${authorName}</p></div>`;
    });

    // We need to wait for all promises to resolve before we can return the HTML.
    // Otherwise, the function will return before the promises resolve,
    // and [object Promise] will be returned instead.
    const playHtmlArray = await Promise.all(playPromises);
    html = playHtmlArray.join(''); // Combine HTML strings into a single string

    return html;
  } catch (error) {
    console.error("Error generating play template:", error);
    return "";
  }
}

async function getTemplate(data: any, type: string): Promise<string> {
  if (type === "characters") {
    return generateCharacterTemplate(data);
  } else if (type === "plays") {
    return generatePlayTemplate(data);
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
  var listOfEls = getGridElements(type);
  // @ts-ignore
  $(listOfEls[0]).pagination({
    dataSource: dataSource,
    pageSize: calcPageSize(),
    showGoInput: true,
    formatGoInput: "go to <%= input %>",
    // The callback needs to be async
    // because we need to wait for the template to be generated
    callback: async (data, pagination) => {
      try {
        var html = await getTemplate(data, type);
        $(listOfEls[1]).html(html);
      } catch (error) {
        console.error(error);
      }
    },
  });
}

async function getPlayInfo(id: any, type: string) : Promise<string> {
  if (id === undefined) {
    return "Unknown";
  }

  switch (type) {
    case "publisher":
      return id;

    case "author":
      const data = await getJSON("/json/author_data.json");

      if (id.length > 1) {
        const authorNames = id.map((authorId: string) =>
        data["authors"][authorId]["fullName"]);

        return authorNames.join(", ");
      } else {
        //todo:
      }

      console.log(id);
      console.log(id[0]);
      return "unk"
      //return data["authors"][id[0]]["fullName"];
  }
}

async function fetchData(): Promise<void> {
  try {
    const JSONFiles = ["/json/char_data.json", "/json/play_data.json"];
    const types = ["characters", "plays"];

    const [charData, playData] = await Promise.all(JSONFiles.map((file: string) => getJSON(file)));

    const charTemplate = await getTemplate(charData, types[0]);
    const playTemplate = await getTemplate(playData, types[1]);

    $("#char-list").html(charTemplate);
    $("#play-list").html(playTemplate);

    setPagination(charData[types[0]], types[0]);
    setPagination(playData[types[1]], types[1]);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

$(function () {
  fetchData();

  // this is not a so good idea, we'll think more about that later
  //$(window).on("resize", fetchData);
});