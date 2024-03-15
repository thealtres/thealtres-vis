let margin = {top: 0, right: 0, bottom: 30, left: 30},
    width = 900 - margin.left - margin.right,
    height = 420 - margin.top - margin.bottom;

let x;
let y;
let xAxis;
let yAxis;

let chartGroups = {
    "authorGender": {
        "text": "author gender", // text to display in dropdown
        "M": "blue",
        "F": "red",
        "U": "green",
    },
    "charGender": {
        "text": "character gender", // text to display in dropdown
        "M": "brown",
        "F": "pink",
        "U": "violet",
        "B": "orange",
    },
    "playGenre": {
        "text": "play genre", // text to display in dropdown
        "comedy": "yellow",
        "tragedy": "black",
    }
}

function getYValues(key) {
    return Object.keys(chartGroups[key]).filter(function(d) { return d !== "text"; });
}

function getMaxestNumberOfY(data, key) {
    console.log("Called getMaxestNumberOfY with key", key);
    // return maxest Y value among max Y values
    return d3.max(data, function(d) {
        // return max Y value for each group
        return d3.max(getYValues(key), function(group) {
            return d[group];
        });
    });
}

function setChartSelect(data) {
    d3.select("#chartSelectBtn")
    .selectAll("options")
        .data(Object.keys(chartGroups))
    .enter()
        .append("option")
    // text to display in dropdown
    .text(function (d) { return chartGroups[d].text; })
    // corresponding value returned by the button
    .attr("value", function (d) { return d; });
}

export function drawChart(data, chartType) {
    console.log(`Called drawChart with chartType: ${chartType}`)

    x = null;
    y = null;

    if (chartType === undefined) chartType = Object.keys(chartGroups)[0];

    // remove existing chart
    if (d3.select("#chart").selectAll("*").length > 0) {
        d3.select("#chart").selectAll("*").remove();
    }

    // append the svg object to the body of the page
    var svg = d3.select("#chart")
    .append("svg")
        //.attr("width", width + margin.left + margin.right)
        //.attr("height", height + margin.top + margin.bottom)
        .attr("viewBox", "-10 -5 950 1120") //! old: 0 70 870 390
        // 0 -30 1000 560
        //new responsive: 0 -30 950 1100
    .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // parse every year to D3 time format
    data.sort(function(x, y) {
        return d3.ascending(x.year, y.year);
    });

    // add X axis (date format)
    const dataXrange = d3.extent(data, function(d) { return d.year; });
    x = d3.time.scale()
    .domain(dataXrange)
    .range([0, width]);

    xAxis = svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .attr("class", "x-axis")
    .call(d3.svg.axis().scale(x).orient("bottom"));

    // add Y axis
    y = d3.scale.linear()
    .domain([0, getMaxestNumberOfY(data, chartType)]).nice()
    .range([height, 0]);

    console.log("maxestDrawChart", getMaxestNumberOfY(data, d3.select("#chartSelectBtn").property("value")))
    console.log(data)

    yAxis = svg.append("g")
    .attr("class", "y-axis")
    .call(d3.svg.axis().scale(y).orient("left").ticks(5));

    // create line for each group
    for (const group of getYValues(chartType)) {
        createLine(svg, data, group, chartGroups[chartType][group]);
    }

    // add legend dot
    svg.selectAll("dots")
    // don't include the text key (used for dropdown)
    .data(Object.keys(chartGroups[chartType]).filter(function(d) { return d !== "text"; }))
    .enter()
    .append("circle")
    .attr("cx", width - 40)
    .attr("cy", function(d,i){ return i*25}) // 25 is the distance between dots
    .attr("r", 7)
    .style("fill", function(d){ return chartGroups[chartType][d]})

    // add legend labels
    svg.selectAll("labels")
    // don't include the text key (used for dropdown)
    .data(Object.keys(chartGroups[chartType]).filter(function(d) { return d !== "text"; }))
    .enter()
    .append("text")
      .attr("x", width - 20)
      .attr("y", function(d,i){ return 5 + i*25}) // 25 is the distance between dots
      .style("fill", function(d){ return chartGroups[chartType][d]})
      .text(function(d){ return d})
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle")
}

function createLine(svg, data, group, color) {
    return svg.append("g")
    .append("path")
        .datum(data)
        .attr("d", d3.svg.line()
        .x(function(d) { return x(d.year); })
        .y(function(d) { return y(d[group]); })
        )
        .attr("data-value", group)
        .attr("stroke", color)
        .style("stroke-width", 4)
        .style("fill", "none");
}

// data = Play[]
export function setChart(data, chartType = Object.keys(chartGroups)[0]) {
    setChartSelect(data);
    drawChart(data, chartType);
}

export function updateChart(data) {
    console.log("Updating chart with data of length", data.length, data);
    // we set 1 because we need at least 2 data points to draw a line
    if (data.length <= 1) {
        d3.select("#chart").selectAll("*").attr("display", "none");

        // disable dropdown
        d3.select("#chartSelectBtn").attr("disabled", true);

        console.log(d3.select("#chart").selectAll("svg image").length)

        // check if svg already exists
        if (d3.select("#chart").selectAll("svg image").length > 1) {
            return;
        }

        d3.select("#chart").append("svg")
        .append("image")
            .attr("xlink:href", "/svg/nodata.svg")
            .attr("width", "100%")
            .attr("height", "100%");
        return;
    }

    d3.select("#chartSelectBtn").attr("disabled", null);
    // remove all that's not the chart
    d3.select("#chart").selectAll("svg:not([viewBox])").remove();
    d3.select("#chart").selectAll("*").attr("display", null);

    data.sort(function(x, y) {
        return d3.ascending(x.year, y.year);
    });

    x.domain(d3.extent(data, function(d) { return d.year; }));
    y.domain([0, getMaxestNumberOfY(data, d3.select("#chartSelectBtn").property("value"))]);

    console.log("maxestUpdateChart", getMaxestNumberOfY(data, d3.select("#chartSelectBtn").property("value")))

    d3.select("#chart").select(".x-axis")
    .transition()
    .duration(0)
    .call(d3.svg.axis().scale(x).orient("bottom"));

    console.log("y", y.domain());

    d3.select("#chart").select(".y-axis")
    .transition()
    .duration(0)
    .call(d3.svg.axis().scale(y).orient("left").ticks(5));

    // get chart lines
    d3.select("#chart").selectAll("path").each(function(d, i) {
        const lineValue = d3.select(this).attr("data-value");

        console.log("lineValue", lineValue, data);

        d3.select(this)
        .datum(data)
        .attr("d", d3.svg.line()
            .x(function(d) { return x(d.year); })
            .y(function(d) { return y(d[lineValue]); })
        )
    });
}