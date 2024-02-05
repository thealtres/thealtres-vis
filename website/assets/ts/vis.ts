import { get } from "jquery";
import { Character, Play } from "./IEntity";

function getJSON(path: string, callback: (data: any) => void) : void {
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
      callback(data)
    },
    error: (jqXHR, textStatus, errorThrown) => {
      console.log("Error: " + errorThrown);
    }
  });
};

function showJSONData(data: any, type: string) : void {
  setPagination(data[type], type);
};

function getTemplate(data: any, type: string) : string {
  if (type === "characters") {
    var html = "<ul>";
    $.each(data, function(index, character) {
      html += "<li>"+ character.persName +"</li>";
    });
    html += "</ul>";
  }

  else if (type === "plays") {
    var html = ""
    $.each(data, function(index, play) {
      var titleMain = play.titleMain;
      var titleSub = play.titleSub;
      var authorId = play.authorId;
      var authorName = getPlayInfo(authorId, "author");
      console.log(authorId, authorName)
      //var publisher = getPlayInfo(play.publisher, "publisher");
      html += "<div class='play-card'><p>"+ titleMain + "<br>" + authorName +"</p></div>";
    });
  };

  return html;
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
  var listOfEls = getGridElements(type);
  // @ts-ignore
  $(listOfEls[0]).pagination({
    dataSource: dataSource,
    pageSize: calcPageSize(),
    showGoInput: true,
    formatGoInput: "go to <%= input %>",
    callback: (data, pagination) => {
      var html = getTemplate(data, type);
      $(listOfEls[1]).html(html);
    }
  });
}

function getPlayInfo(id: any, type: string) : void {
  switch (type) {
    case "publisher":
      return id;
    case "author":
      $.getJSON("/json/author_data.json", (data) : string => {
        if (id.length > 1) {
          var authorNames = [];
          id.forEach((authorId) => {
            authorNames.push(data["authors"][authorId]["fullName"]);
          });
          console.log(authorNames.join(", "))
          return authorNames.join(", ");
        }

        console.log(id)
        console.log(id[0])
        return data["authors"][id[0]]["fullName"];
      });
  }
}

$(function() {
  const JSONFiles = ["/json/char_data.json", "/json/play_data.json"];
  const types = ["characters", "plays"];

  JSONFiles.forEach((file, index) => {
    getJSON(file, (data) => { showJSONData(data, types[index]) });
  });

  $(window).on("resize", () => {
    JSONFiles.forEach((file, index) => {
      getJSON(file, (data) => { showJSONData(data, types[index]) });
    });
  });
});