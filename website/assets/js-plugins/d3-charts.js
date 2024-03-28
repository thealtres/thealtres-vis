let margin = {top: 0, right: 0, bottom: 30, left: 30},
    width = 900 - margin.left - margin.right,
    height = 420 - margin.top - margin.bottom;

let x;
let y;

let chartGroups = {
    "authorGender": {
        "text": "author gender", // text to display in dropdown
        "M": "#198038",
        "F": "#fa8775",
        "U": "#a56eff",
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
        "comedy": "#28536b",
        "vaudeville": "#e072a4",
        "drama": "#bbb193",
    }
}

function getYValues(key) {
    return Object.keys(chartGroups[key]).filter(function(d) { return d !== "text"; });
}

function getMaxestNumberOfY(data, key) {
    //console.log("Called getMaxestNumberOfY with key", key);
    // return maxest Y value among max Y values
    return d3.max(data, function(d) {
        // return max Y value for each group
        return d3.max(getYValues(key), function(group) {
            return d[group];
        });
    });
}

function setChartSelect(data) {
    d3.select("#chart-select-btn")
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

    // remove any tooltips
    d3.select(".chart-tooltip").remove();

    // append the svg object to the body of the page
    var svg = d3.select("#chart")
    .append("svg")
        //.attr("width", width + margin.left + margin.right)
        //.attr("height", height + margin.top + margin.bottom)
        .attr("viewBox", "-10 -20 950 440") //! old: 0 70 870 390
        .attr("preserveAspectRatio", "xMidYMid meet")
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
    .attr("cx", width - 60)
    .attr("cy", function(d,i){ return i*25}) // 25 is the distance between dots
    .attr("r", 7)
    .style("fill", function(d){ return chartGroups[chartType][d]})

    // add legend labels
    svg.selectAll("labels")
    // don't include the text key (used for dropdown)
    .data(Object.keys(chartGroups[chartType]).filter(function(d) { return d !== "text"; }))
    .enter()
    .append("text")
      .attr("x", width - 40)
      .attr("y", function(d,i){ return 5 + i*25}) // 25 is the distance between dots
      .style("fill", function(d){ return chartGroups[chartType][d]})
      .style("font-weight", "bold")
      .text(function(d){ return d})
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle")

    // add focus rect
    const focus = svg.append("g")
    .append("rect")
    .style("fill", "black")
    .style("pointer-events", "all")
    .style("stroke", "black")
    .style("stroke-width", "1px")
    .attr("width", 5)
    .attr("x", -5) // compensate for the width
    .attr("height", height)
    .style("opacity", 0);

    // add tooltip
    const tooltip = d3.select("body")
    .append("div")
    .attr("class", "chart-tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "1px")
    .style("border-radius", "5px")
    .style("padding", "5px");

    // add tooltip handling on mousemove
    svg.append("rect")
    .attr("class", "overlay")
    .attr("width", width)
    .attr("height", height)
    .style("opacity", 0)
    .on("mouseover", function() { tooltip.style("opacity", 1); focus.style("opacity", 0.5); })
    .on("mouseout", function() { tooltip.style("opacity", 0); focus.style("opacity", 0); })
    .on("mousemove", function() {
        const mouseX = d3.mouse(this)[0];
        const event = d3.event;
        const pageX = event.pageX;
        const pageY = event.pageY;
        handleTooltip(data, chartType, tooltip, focus, mouseX, pageX, pageY);
    });
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

function handleTooltip(data, chartType, tooltip, focus, mouseX, pageX, pageY) {
    const hoveredYear = x.invert(mouseX);
    const tooltipData = data.find(d => d.year.getFullYear() === hoveredYear.getFullYear());

    if (tooltipData) {
        const yValues = getYValues(chartType);
        // calculate group percentage for the hovered year
        const total = yValues.reduce((acc, group) => acc + tooltipData[group], 0);
        const tooltipPct = yValues.map(group => {
            return {
                group,
                pct: Math.round((tooltipData[group] / total) * 100) || 0
            }
        });

        const tooltipContent = `
        <div><strong>Year: ${tooltipData.year.getFullYear()}</strong></div>
        ${yValues.map(group => `
            <div>
            <span style="color: ${chartGroups[chartType][group]};">●</span>
            ${group}: ${tooltipData[group]}
            (${tooltipPct.find(p => p.group === group).pct}%)
            </div>
        `).join("")}
        `;

        tooltip.html(tooltipContent)
        .style("left", (pageX + 20) + "px")
        .style("top", (pageY - 30) + "px");

        focus.attr("transform", `translate(${x(hoveredYear)}, 0)`);
    }
}

// data = Play[]
export function setChart(data, chartType = Object.keys(chartGroups)[0]) {
    setChartSelect(data);
    drawChart(data, chartType);
}

export function updateChart(data) {
    // show "no data" image
    // we set 1 because we need at least 2 data points to draw a line
    if (data.length <= 1) {
        d3.select("#chart").selectAll("*").attr("display", "none");

        // disable dropdown
        d3.select("#chart-select-btn").attr("disabled", true);

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

    d3.select("#chart-select-btn").attr("disabled", null);
    // remove all that's not the chart
    d3.select("#chart").selectAll("svg:not([viewBox])").remove();
    d3.select("#chart").selectAll("*").attr("display", null);

    data.sort(function(x, y) {
        return d3.ascending(x.year, y.year);
    });

    x.domain(d3.extent(data, function(d) { return d.year; }));
    y.domain([0, getMaxestNumberOfY(data, d3.select("#chart-select-btn").property("value"))]);

    d3.select("#chart").select(".x-axis")
    .transition()
    .duration(0)
    .call(d3.svg.axis().scale(x).orient("bottom"));

    d3.select("#chart").select(".y-axis")
    .transition()
    .duration(0)
    .call(d3.svg.axis().scale(y).orient("left").ticks(5));

    // get chart lines
    d3.select("#chart").selectAll("path").each(function(d, i) {
        const lineValue = d3.select(this).attr("data-value");

        d3.select(this)
        .datum(data)
        .attr("d", d3.svg.line()
            .x(function(d) { return x(d.year); })
            .y(function(d) { return y(d[lineValue]); })
        )
    });
}