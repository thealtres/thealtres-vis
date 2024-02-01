function loadJSON(path) {
  $.ajax({
    url: path,
    dataType: "json",
    success: function(data) {
      showJSONData(data);
    }
  });
}

function showJSONData(data) {
  var characters = data.data.characters;

  $.each(characters, function(index, character) {
    console.log(character.persName);
  });
}

loadJSON("/json/char_data.json");


// let myChart = Highcharts.chart("container", {
//   chart: {
//     type: "bar"
//   },

//   title: {
//     text: "Fruit Consumption"
//   },

//   xAxis: {
//     categories: ["Apples", "Bananas", "Oranges"]
//   },

//   yAxis: {
//     title: {
//       text: "Fruit eaten"
//     }
//   },

//   series: [
//     {
//       name: "Jane",
//       data: [1, 0, 4]
//     },
//     {
//       name: "John",
//       data: [5, 7, 3]
//     }
//   ]
// })