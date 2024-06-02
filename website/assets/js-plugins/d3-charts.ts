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
        "vaudeville": "#e072a4",
        "comedy": "#28536b",
        "posse": "#8B9EB7",
        "schwank": "#f7b633",
        "drama": "#bbb193",
        "other": "#632A50",
    }
}

/**
 * Returns an array of y-values for the given key.
 *
 * @param key - The key to retrieve y-values for.
 * @returns An array of y-values.
 */
function getYValues(key: string): string[] {
    return Object.keys(chartGroups[key]).filter(function(d) { return d !== "text"; });
}

/**
 * Returns the maximum Y value among the maximum Y values for each group in the data.
 *
 * @param data - The data array.
 * @param key - The key used to access the Y values for each group.
 * @returns The maximum Y value.
 */
function getMaxestNumberOfY(data: any[], key: string): number {
    // return maxest Y value among max Y values
    return d3.max(data, function(d) {
        // return max Y value for each group
        return d3.max(getYValues(key), function(group) {
            return d[group];
        });
    });
}

/**
 * Calculates the maximum text width among the given chart labels.
 *
 * @param labels - The labels to calculate the maximum text width for.
 * @returns The maximum text width among the labels.
 */
function getMaxTextWidth(labels: any) : number {
    return d3.max(d3.merge(labels), function(d) {
      return d.getComputedTextLength();
    });
}

/**
 * Sets the chart select dropdown options based on the chartGroups object.
 */
function setChartSelect() : void {
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

/**
 * Draws a chart based on the provided data and chart type.
 * @param data - An array of data points.
 * @param chartType - The type of chart to be drawn.
 */
export function drawChart(data: any[], chartType: string) : void {
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
    // -3 to fix last year being untooltipable. Not sure why
    .range([0, width - 3]);

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
    .call(d3.svg.axis().scale(y).orient("left").ticks(5).tickFormat(d3.format("d")));

    // create line for each group
    for (const group of getYValues(chartType)) {
        createLine(svg, data, group, chartGroups[chartType][group]);
    }

    // add legend labels
    const labels = svg.selectAll("labels")
    // don't include the text key (used for dropdown)
    .data(Object.keys(chartGroups[chartType]).filter(function(d) { return d !== "text"; }))
    .enter()
    .append("text")
      .attr("y", function(d,i){ return 7 + i*25}) // 25 is the distance between dots
      .attr("data-value", function(d) { return d; })
      .style("fill", function(d){ return chartGroups[chartType][d]})
      .style("font-weight", "bold")
      .style("font-size", "1.5em")
      .text(function(d){ return d})
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle")

    // add focus rect
    const focus = svg.append("g")
    .append("rect")
    .attr("class", "chart-rect")
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
    .attr("class", "chart-overlay")
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

    // add legend dot
    const legendDots = svg.selectAll("dots")
    // don't include the text key (used for dropdown)
    .data(Object.keys(chartGroups[chartType]).filter(function(d) { return d !== "text"; }))
    .enter()
    .append("circle")
    .attr("cy", function(d,i){ return i*25}) // 25 is the distance between dots
    .attr("r", 7)
    .attr("data-value", function(d) { return d; })
    .style("fill", function(d){ return chartGroups[chartType][d]})
    .style("z-index", 1000)
    .on("click", function(d) {
        toggleLine(d);
    });

    // position legend according to the width of the longest label
    labels.attr("x", width - getMaxTextWidth(labels));
    legendDots.attr("cx", width - getMaxTextWidth(labels) - 20);
}

/**
 * Creates a line chart in the given SVG element using the provided data.
 * @param svg - The SVG element to append the line chart to.
 * @param data - An array of data points for the line chart.
 * @param group - The group identifier for the line chart.
 * @param color - The color of the line chart.
 * @returns The created line chart element.
 */
function createLine(svg: any, data: any[], group: string, color: string) : any {
    // don't draw line if all values for that group are 0
    if (data.every(d => d[group] === 0)) {
        return;
    }

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

/**
 * Toggles chart lines and change the opacity of the corresponding dots and labels when clicked.
 * @param d - The data value associated with the elements to toggle.
 */
function toggleLine(d) : void {
    const line = d3.select(`path[data-value="${d}"]`);
    const visible = line.style("display") === "none";

    line.style("display", visible ? "block" : "none");
    d3.select(`circle[data-value="${d}"]`).style("opacity", visible ? 1 : 0.3);
    d3.select(`text[data-value="${d}"]`).style("opacity", visible ? 1 : 0.3);
}

/**
 * Handles the tooltip for a chart.
 * @param data - The data array for the chart.
 * @param chartType - The type of chart.
 * @param tooltip - The tooltip element.
 * @param focus - The focus element.
 * @param mouseX - The x-coordinate of the mouse.
 * @param pageX - The x-coordinate of the page.
 * @param pageY - The y-coordinate of the page.
 */
function handleTooltip(data: any[], chartType: string, tooltip: any, focus: any, mouseX: number, pageX: number, pageY: number) : void {
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

        // move tooltip to the left if it's too close to the right edge
        const tooltipWidth = tooltip.node().getBoundingClientRect().width;
        const availSpace = window.innerWidth - pageX;

        if (availSpace < (tooltipWidth + 20)) {
            tooltip.style("left", `${pageX - tooltipWidth - 20}px`);
        } else {
            tooltip.style("left", `${pageX + 20}px`);
        }

        tooltip.style("top", `${pageY - 30}px`);

        focus.attr("transform", `translate(${x(hoveredYear)}, 0)`);
    }
}

/**
 * Sets the chart with the given data and chart type.
 * @param data - The data for the chart.
 * @param chartType - The type of chart to be drawn. Defaults to the first chart type in the chartGroups object.
 */
export function setChart(data: any, chartType: string = Object.keys(chartGroups)[0]) : void {
    setChartSelect();
    drawChart(data, chartType);
}

/**
 * Updates the chart with the given data.
 * @param data - The data to update the chart with.
 */
export function updateChart(data: any) : void {
    // show "no data" text
    // we set 1 because we need at least 2 data points to draw a line
    if (data.length <= 1) {
        d3.select("#chart").selectAll("*").attr("display", "none");

        // disable dropdown
        d3.select("#chart-select-btn").attr("disabled", true);

        // check if svg already exists
        if (d3.select("#chart").selectAll("svg text").length > 1) {
            return;
        }

        d3.select("#chart").append("svg")
        .append("text")
            .attr("x", 10)
            .attr("y", 50)
            .text("No data available")
            .style("font-size", "1.5em")
            .style("font-weight", "bold");
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
    .call(d3.svg.axis().scale(y).orient("left").ticks(5).tickFormat(d3.format("d")));

    // get chart lines
    d3.select("#chart").selectAll("path").each(function(d, i) {
        const lineValue = d3.select(this).attr("data-value");

        // don't draw line if all values for that group are 0
        if (data.every(d => d[lineValue] === 0)) {
            // hide line using css instead of removing it
            // so that it can be shown again if the data changes
            d3.select(this).attr("display", "none");
            return;
        }

        d3.select(this)
        .datum(data)
        .attr("d", d3.svg.line()
            .x(function(d) { return x(d.year); })
            .y(function(d) { return y(d[lineValue]); })
        )
    });

    // update tooltips
    d3.select("#chart").select(".chart-overlay")
    .on("mousemove", function() {
        const mouseX = d3.mouse(this)[0];
        const event = d3.event;
        const pageX = event.pageX;
        const pageY = event.pageY;
        handleTooltip(data, d3.select("#chart-select-btn").property("value"), d3.select(".chart-tooltip"), d3.select(".chart-rect"), mouseX, pageX, pageY);
    });
}