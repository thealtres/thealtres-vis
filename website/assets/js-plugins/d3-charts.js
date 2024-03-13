// set the dimensions and margins of the graph
var margin = {top: 0, right: 0, bottom: 30, left: 30},
    width = 900 - margin.left - margin.right,
    height = 420 - margin.top - margin.bottom;

var x;
var y;

function getMaxNumberOfY(data) {
    return data.reduce((max, obj) => {
        const maxMFU = Math.max(obj.M, obj.F, obj.U);
        return Math.max(max, maxMFU);
    }, -Infinity);
}

// data = Play[]
export function setChart(data) {
    // append the svg object to the body of the page
    var svg = d3.select("#chart")
    .append("svg")
        //.attr("width", width + margin.left + margin.right)
        //.attr("height", height + margin.top + margin.bottom)
        .attr("viewBox", `0 -10 950 1120`) //! old: 0 70 870 390
        // 0 -30 1000 560
        //new responsive: 0 -30 950 1100
    .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // List of groups (here I have one group per column)
    var allGroup = ["M", "F", "U"];

    // parse every year to D3 time format
    data.sort(function(x, y) {
        return d3.ascending(x.year, y.year);
    });

    // Add the options to the button
    d3.select("#selectButton")
    .selectAll('myOptions')
        .data(allGroup)
    .enter()
        .append('option')
    .text(function (d) { return d; }) // text showed in the menu
    .attr("value", function (d) { return d; }); // corresponding value returned by the button

    // A color scale: one color for each group
    var color = d3.scale.ordinal()
    .domain(allGroup)
    .range(d3.scale.category10().range());

    console.log("dataChart", data)

    const dataXrange = d3.extent(data, function(d) { return d.year; });

    console.log(dataXrange)

    // Add X axis --> it is a date format
    x = d3.time.scale()
    .domain(dataXrange)
    .range([0, width]);
    svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.svg.axis().scale(x).orient("bottom"));

    // Add Y axis
    y = d3.scale.linear()
    .domain([0, getMaxNumberOfY(data)])
    .range([height, 0]);
    svg.append("g")
    .call(d3.svg.axis().scale(y).orient("left"));

    // Initialize line with group a
    var lineM = svg
    .append('g')
    .append("path")
        .datum(data)
        .attr("d", d3.svg.line()
        .x(function(d) { return x(d.year); })
        .y(function(d) { return y(d.M); })
        )
        .attr("data-value", "M")
        .attr("stroke", function(d){ return color("M"); })
        .style("stroke-width", 4)
        .style("fill", "none");

    var lineF = svg
    .append('g')
    .append("path")
        .datum(data)
        .attr("d", d3.svg.line()
        .x(function(d) { return x(d.year); })
        .y(function(d) { return y(d.F); })
        )
        .attr("data-value", "F")
        .attr("stroke", function(d){ return color("F"); })
        .style("stroke-width", 4)
        .style("fill", "none");

    var lineU = svg
    .append('g')
    .append("path")
        .datum(data)
        .attr("d", d3.svg.line()
        .x(function(d) { return x(d.year); })
        .y(function(d) { return y(d.U); })
        )
        .attr("data-value", "U")
        .attr("stroke", function(d){ return color("U"); })
        .style("stroke-width", 4)
        .style("fill", "none");

    // add legend dot
    svg.selectAll("dots")
    .data(allGroup)
    .enter()
    .append("circle")
    .attr("cx", width - 40)
    .attr("cy", function(d,i){ return i*25}) // 25 is the distance between dots
    .attr("r", 7)
    .style("fill", function(d){ return color(d)})

    // add legend labels
    svg.selectAll("labels")
    .data(allGroup)
    .enter()
    .append("text")
      .attr("x", width - 20)
      .attr("y", function(d,i){ return 5 + i*25}) // 25 is the distance between dots
      .style("fill", function(d){ return color(d)})
      .text(function(d){ return d})
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle")

    // When the button is changed, run the updateChart function
    d3.select("#selectButton").on("change", function() {
        // Recover the option that has been chosen
        var selectedOption = d3.select(this).property("value");
        // Run the updateChart function with this selected option
        update(selectedOption);
    });
}

export function updateChart(data) {
    console.log("Updating chart with data", data);

    data.sort(function(x, y) {
        return d3.ascending(x.year, y.year);
    });

    // get chart lines
    d3.select("#chart").selectAll("path").each(function(d, i) {
        const lineValue = d3.select(this).attr("data-value");

        console.log("lineValue", lineValue, data);

        d3.select(this)
        .datum(data)
        .transition()
        .duration(1000)
        .attr("d", d3.svg.line()
            .x(function(d) { return x(d.year); })
            .y(function(d) { return y(d[lineValue]); })
        )
    });
}