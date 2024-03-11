/*
D3 Timeline originally created by robyngit:
https://gist.github.com/robyngit/89327a78e22d138cff19c6de7288c1cf
Licence: BY-NC https://gist.github.com/robyngit/89327a78e22d138cff19c6de7288c1cf#file-license-md

Modified to only have small brush chart (named "Context Chart"),
and show years only
*/

var optwidth = 900;
var optheight = 150;

let highlightColors = {
    "fre": "rgba(0, 170, 255, 0.7)", // blue
    "ger": "rgba(255, 255, 0, 0.7)", // yellow
    "als": "rgba(255, 25, 25, 0.7)", // red
    "unique": "rgba(255, 204, 0, 0.5)",
    "default": "rgba(255, 255, 255, 0.3)",
}

// global variables used for export function highlightGraphPeriod()
var context = null;
var height_context = null;
var y = null;
var x2 = null;
var y2 = null;
var brush = null;
var brushg = null;
var dataXrange = null;

/*
* ========================================================================
*  Prepare data
* ========================================================================
*/

export function setTimeline(dataset) {
    dataset.forEach(function(d) {
        // parse every year to D3 time format
        d.year = d3.time.format("%Y").parse(d.year);
    });

    // sort dataset by year
    dataset.sort(function(x, y) {
        return d3.ascending(x.year, y.year);
    });


    /*
    * ========================================================================
    *  sizing
    * ========================================================================
    */

    /* === Focus chart === */
    // !warning: some values are used for context chart; do not change

    var margin	= {top: 20, right: 30, bottom: 50, left: 20},
        width	= optwidth - margin.left - margin.right,
        height	= optheight - margin.top - margin.bottom;

    /* === Context chart === */

    var margin_context = {top: 50, right: 30, bottom: 20, left: 20}
    height_context = optheight - margin_context.top - margin_context.bottom;

    /*
    * ========================================================================
    *  x and y coordinates
    * ========================================================================
    */

    // year
    dataXrange = d3.extent(dataset, function(d) { return d.year; });
    // number of plays (by year)
    var dataYrange = [0, d3.max(dataset, function(d) { return d.count; })];

    // maximum date range allowed to display
    var mindate = dataXrange[0],  // min year
        maxdate = dataXrange[1];  // max year

    var DateFormat = d3.time.format("%Y");

    /* === Focus Chart === */

    var x = d3.time.scale()
        .range([0, (width)])
        .domain(dataXrange);

    y = d3.scale.linear()
        .range([height, 0])
        .domain(dataYrange);;

    /* === Context Chart === */

    x2 = d3.time.scale()
        .range([0, width])
        .domain([mindate, maxdate]);

    y2 = d3.scale.linear()
        .range([height_context, 0])
        .domain(y.domain());

    var xAxis_context = d3.svg.axis()
        .scale(x2)
        .orient("bottom")
        // used to create the ticks
        .ticks(customTickFunction)
        // used to format the ticks to year
        .tickFormat(DateFormat);

    var yAxis_context = d3.svg.axis()
        .scale(y2)
        .orient("left")
        .tickValues([0, getMaxNumberOfPlays()])

    /*
    * ========================================================================
    *  Plotted line and area variables
    * ========================================================================
    */

    /* === Context Chart === */

    var area_context = d3.svg.area()
        .x(function(d) { return x2(d.year); })
        .y0((height_context))
        .y1(function(d) { return y2(d.count); });

    var line_context = d3.svg.line()
        .x(function(d) { return x2(d.year); })
        .y(function(d) { return y2(d.count); });

    var highlight_area = d3.svg.area()
        .x(function(d) { return x2(d.year); })
        .y0((height_context))
        .y1(function(d) { return y2(d.count); });

    var highlight_line = d3.svg.line()
        .x(function(d) { return x2(d.year); })
        .y(function(d) { return y2(d.count); });

    /*
    * ========================================================================
    *  Variables for brushing and zooming behaviour
    * ========================================================================
    */

    brush = d3.svg.brush()
        .x(x2)
        .on("brush", brushed)
        .on("brushend", brushend);

    var zoom = d3.behavior.zoom()
        .on("zoom", draw)
        .on("zoomend", brushend);

    /*
    * ========================================================================
    *  Define the SVG area ("vis") and append all the layers
    * ========================================================================
    */

    // === the main components === //

    var vis = d3.select("#timeline").append("svg")
        //.attr("width", 1200) // !old: width + margin.left + margin.right
        //.attr("height", 200) // !old: height + margin.top + margin.bottom
        .attr("viewBox", "0 30 900 130") //! better use this for responsiveness
        .attr("class", "metric-chart"); // CB -- "line-chart" -- CB //

    vis.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height);
        // clipPath is used to keep line and area from moving outside of plot area when user zooms/scrolls/brushes

    context = vis.append("g")
        .attr("class", "context")
        .attr("transform", "translate(" + margin_context.left + "," + margin_context.top + ")");

    // brushes
    var rect = vis.append("svg:rect")
        .attr("class", "pane")
        .attr("width", width)
        .attr("height", height)
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .call(zoom)
        .call(draw);

    // === current date range text & zoom buttons === //

    var display_range_group = vis.append("g")
        .attr("id", "buttons_group")
        .attr("transform", "translate(" + 0 + ","+ (margin_context.bottom + 10) +")");

    //! "Showing data from" section
    var expl_text = display_range_group.append("text")
        .text("Showing data from: ")
        .style("text-anchor", "start")
        .attr("transform", "translate(" + 0 + ","+ 10 +")");

    //! "Showing data from" section (2)
    display_range_group.append("text")
        .attr("id", "displayDates")
        .text(DateFormat(dataXrange[0]) + " - " + DateFormat(dataXrange[1]))
        .style("text-anchor", "start")
        .attr("transform", "translate(" + 98 + ","+ 10 +")");

    //! "Zoom to" section
    // var expl_text = display_range_group.append("text")
    //     .text("Zoom to: ")
    //     .style("text-anchor", "start")
    //     .attr("transform", "translate(" + 180 + ","+ 10 +")");

    // === the zooming/scaling buttons === //

    var button_width = 40;
    var button_height = 14;

    // don't show year button if < 1 year of data
    //! this isn't really interesting for us so let's just replace
    //! data with "reset"
    var button_data = ["reset"];
    // var dateRange  = dataXrange[1] - dataXrange[0],
    //     ms_in_year = 31540000000;

    // if (dateRange < ms_in_year)   {
    //     var button_data =["month","data"];
    // } else {
    //     var button_data =["year","month","data"];
    // };

    var button = display_range_group.selectAll("g")
        .data(button_data)
        .enter().append("g")
        .attr("class", "scale_button")
        .attr("transform", function(d, i) { return "translate(" + (220 + i*button_width + i*10) + ",0)"; })
        .on("click", scaleDate);

    button.append("rect")
        .attr("width", button_width)
        .attr("height", button_height)
        .attr("rx", 1)
        .attr("ry", 1);

    button.append("text")
        .attr("dy", (button_height/2 + 3))
        .attr("dx", button_width/2)
        .style("text-anchor", "middle")
        .text(function(d) { return d; });

    /* === focus chart === */

    /* === context chart === */

    context.append("path")
        .datum(dataset)
        .attr("class", "area")
        .attr("d", area_context);

    context.append("path")
        .datum(dataset)
        .attr("class", "line")
        .attr("d", line_context);

    context.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height_context + ")")
        .call(xAxis_context)

    context.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate(0,0)") //!
        .call(yAxis_context)

    /* === brush (part of context chart)  === */

    brushg = context.append("g")
        .attr("class", "x brush")
        .call(brush);

    brushg.selectAll(".extent")
    .attr("y", -6)
    .attr("height", height_context + 8);
    // .extent is the actual window/rectangle showing what's in focus

    brushg.selectAll(".resize")
        .append("rect")
        .attr("class", "handle")
        .attr("transform", "translate(0," +  -3 + ")")
        .attr('rx', 2)
        .attr('ry', 2)
        .attr("height", height_context) //!
        .attr("width", 3);

    brushg.selectAll(".resize")
        .append("rect")
        .attr("class", "handle-mini")
        .attr("transform", "translate(-2,8)")
        .attr('rx', 3)
        .attr('ry', 3)
        .attr("height", (height_context/2))
        .attr("width", 7);
        // .resize are the handles on either size
        // of the 'window' (each is made of a set of rectangles)

    // allows zooming before any brush action
    zoom.x(x);

    /*
    * ========================================================================
    *  Functions
    * ========================================================================
    */

    // === tick/date formatting functions ===
    // from: https://stackoverflow.com/questions/20010864/d3-axis-labels-become-too-fine-grained-when-zoomed-in

    function timeFormat(formats) {
    return function(date) {
        var i = formats.length - 1, f = formats[i];
        while (!f[1](date)) f = formats[--i];
        return f[0](date);
    };
    };

    function customTickFunction(t0, t1, dt)  {
        var labelSize = 42; 
        var maxTotalLabels = Math.floor(width / labelSize);

        var time = d3.time.year.ceil(t0);
        var times = [];

        while (time < t1) {
          times.push(new Date(+time));
          time = new Date(time.setFullYear(time.getFullYear() + 1));
        }

        if(times.length > maxTotalLabels) {
          times = _.filter(times, function(d, i) {
            return i % Math.ceil(times.length / maxTotalLabels) === 0;
          });
        }

        return times;
    };

    // === brush and zoom functions ===

    function brushed() {

        x.domain(brush.empty() ? x2.domain() : brush.extent());
        // Reset zoom scale's domain
        zoom.x(x);
        updateDisplayDates();
        setYdomain();

    };

    function draw() {
        setYdomain();
        //focus.select(".y.axis").call(yAxis);
        // Force changing brush range
        brush.extent(x.domain());
        vis.select(".brush").call(brush);
        // and update the text showing range of dates.
        updateDisplayDates();
    };

    function brushend() {
    // when brush stops moving:

        // check whether chart was scrolled out of bounds and fix,
        var b = brush.extent();
        var out_of_bounds = brush.extent().some(function(e) { return e < mindate | e > maxdate; });
        if (out_of_bounds){ b = moveInBounds(b) };

    };

    function updateDisplayDates() {

        var b = brush.extent();
        // update the text that shows the range of displayed dates
        var localBrushDateStart = (brush.empty()) ? DateFormat(dataXrange[0]) : DateFormat(b[0]),
        localBrushDateEnd   = (brush.empty()) ? DateFormat(dataXrange[1]) : DateFormat(b[1]);

        // Update start and end dates in upper right-hand corner
        d3.select("#displayDates")
            .text(localBrushDateStart == localBrushDateEnd ? localBrushDateStart : localBrushDateStart + " - " + localBrushDateEnd);
    };

    function moveInBounds(b) {
    // move back to boundaries if user pans outside min and max date.

        var ms_in_year = 31536000000,
            brush_start_new,
            brush_end_new;

        if       (b[0] < mindate)   { brush_start_new = mindate; }
        else if  (b[0] > maxdate)   { brush_start_new = new Date(maxdate.getTime() - ms_in_year); }
        else                        { brush_start_new = b[0]; };

        if       (b[1] > maxdate)   { brush_end_new = maxdate; }
        else if  (b[1] < mindate)   { brush_end_new = new Date(mindate.getTime() + ms_in_year); }
        else                        { brush_end_new = b[1]; };

        brush.extent([brush_start_new, brush_end_new]);

        brush(d3.select(".brush").transition());
        brushed();
        draw();

        return(brush.extent())
    };

    function setYdomain(){
    // this function dynamically changes the y-axis to fit the data in focus

        // get the min and max date in focus
        var xleft = new Date(x.domain()[0]);
        var xright = new Date(x.domain()[1]);

        // a function that finds the nearest point to the right of a point
        var bisectDate = d3.bisector(function(d) { return d.year; }).right;

        // get the y value of the line at the left edge of view port:
        var iL = bisectDate(dataset, xleft);

        if (dataset[iL] !== undefined && dataset[iL-1] !== undefined) {

            var left_dateBefore = dataset[iL-1].month,
                left_dateAfter = dataset[iL].month;

            var intfun = d3.interpolateNumber(dataset[iL-1].count, dataset[iL].count);
            var yleft = intfun((xleft-left_dateBefore)/(left_dateAfter-left_dateBefore));
        } else {
            var yleft = 0;
        }

        // get the x value of the line at the right edge of view port:
        var iR = bisectDate(dataset, xright);

        if (dataset[iR] !== undefined && dataset[iR-1] !== undefined) {

            var right_dateBefore = dataset[iR-1].month,
                right_dateAfter = dataset[iR].month;

            var intfun = d3.interpolateNumber(dataset[iR-1].count, dataset[iR].count);
            var yright = intfun((xright-right_dateBefore)/(right_dateAfter-right_dateBefore));
        } else {
            var yright = 0;
        }

        // get the y values of all the actual data points that are in view
        var dataSubset = dataset.filter(function(d){ return d.year >= xleft && d.year <= xright; });
        var countSubset = [];
        dataSubset.map(function(d) {countSubset.push(d.count);});

        // add the edge values of the line to the array of counts in view, get the max y;
        countSubset.push(yleft);
        countSubset.push(yright);
        var ymax_new = d3.max(countSubset);

        if(ymax_new == 0){
            ymax_new = dataYrange[1];
        }

        // reset and redraw the yaxis
        y.domain([0, ymax_new*1.05]);

    };

    function scaleDate(d,i) {
    // action for buttons that scale focus to certain time interval

        var b = brush.extent(),
            interval_ms,
            brush_end_new,
            brush_start_new;

        if      (d == "year")   { interval_ms = 31536000000}
        else if (d == "month")  { interval_ms = 2592000000 };

        if ( d == "year" | d == "month" )  {

            if((maxdate.getTime() - b[1].getTime()) < interval_ms){
            // if brush is too far to the right that increasing the right-hand brush boundary would make the chart go out of bounds....
                brush_start_new = new Date(maxdate.getTime() - interval_ms); // ...then decrease the left-hand brush boundary...
                brush_end_new = maxdate; //...and set the right-hand brush boundary to the maxiumum limit.
            } else {
            // otherwise, increase the right-hand brush boundary.
                brush_start_new = b[0];
                brush_end_new = new Date(b[0].getTime() + interval_ms);
            };

        } else if ( d == "reset")  {
            brush_start_new = dataXrange[0];
            brush_end_new = dataXrange[1]
        } else {
            brush_start_new = b[0];
            brush_end_new = b[1];
        };

        brush.extent([brush_start_new, brush_end_new]);

        // now draw the brush to match our extent
        brush(d3.select(".brush").transition());
        // now fire the brushstart, brushmove, and brushend events
        brush.event(d3.select(".brush").transition());
    };

    function getMaxNumberOfPlays() {
        return Math.max(...dataset.map(o => o.count))
    }
}

export function highlightGraphPeriod(d1, d2, lang, highlightUnique) {
    // check if highlight at same position
    const existingRect = context.selectAll('[class^="highlight-rect"').filter(function() {
        const x = parseFloat(d3.select(this).attr('x'));
        const width = parseFloat(d3.select(this).attr('width'));
        return x === x2(new Date(d1, 0, 1))
        && width === x2(new Date(d2, 0, 1)) - x2(new Date(d1, 0, 1));
    });

    if (existingRect.size() > 0) {
        return;
    }

    // only show one unique rectangle at a time (for show-play-unique-btn)
    const existingUniqueRect = context.selectAll('[class^="highlight-rect"').filter(function() {
        return d3.select(this).style("fill") === highlightColors["unique"];
    });

    if (existingUniqueRect.size() > 0) {
        clearLastSingleRectHighlight();
    }

    var extentStartX = parseFloat(brushg.select(".extent").attr("x"));
    var extentEndX = extentStartX + parseFloat(brushg.select(".extent").attr("width"));

    var highlightStartX = x2(new Date(d1, 0, 1));
    var highlightEndX = x2(new Date(d2, 0, 1));


    // adjust highlight rectangle if it exceeds extent boundaries
    if (highlightStartX < extentStartX) {
        highlightStartX = extentStartX;
    }

    if (highlightEndX > extentEndX) {
        highlightEndX = extentEndX;
    }

    // add new highlight
    let rectType = "highlight-rect-" + lang;
    let rectColor = highlightColors[lang] || highlightColors["default"];

    if (highlightUnique) {
        rectType += "-unique";
        rectColor = highlightColors["unique"];
    }

    context.append("rect")
    .attr("class", rectType)
    .attr("x", highlightStartX)
    .attr("width", highlightEndX - highlightStartX)
    .attr("y", 0)
    .attr("height", height_context)
    .style("fill", rectColor);
}

export function updateTimelineLangPlot(data) {
    // remove existing lines
    context.selectAll(".language-line").remove();

    const line = d3.svg.line()
        .x(function(d) { return x2(new Date(d.year, 0, 1)); })
        .y(function(d) { return y2(d.value); });

    const langs = [...new Set(data.map(d => d.lang))];

    for (const lang of langs) {
        const langData = data.filter(d => d.lang === lang).sort((a, b) => a.year - b.year);
        console.log(langData)

        context.append("path")
        .datum(langData)
        .attr("class", `language-line ${lang}`)
        .attr("d", line)
        .style("stroke", highlightColors[lang] || highlightColors["default"])
        .style("stroke-width", 2)
        .style("fill", "none");
    }
}

export function raiseHandles() {
    brushg.selectAll(".resize").each(function() {
        this.parentNode.appendChild(this);
    });
}

export function recreateBrush() {
    // remove the brush
    context.selectAll(".brush").remove();

    // recreate the brush
    const brushg = context.append("g")
    .attr("class", "x brush")
    .call(brush);

    brushg.selectAll(".extent")
    .attr("y", -6)
    .attr("height", height_context + 8);
    // .extent is the actual window/rectangle showing what's in focus

    brushg.selectAll(".resize")
        .append("rect")
        .attr("class", "handle")
        .attr("transform", "translate(0," +  -3 + ")")
        .attr('rx', 2)
        .attr('ry', 2)
        .attr("height", height_context) //!
        .attr("width", 3);

    brushg.selectAll(".resize")
        .append("rect")
        .attr("class", "handle-mini")
        .attr("transform", "translate(-2,8)")
        .attr('rx', 3)
        .attr('ry', 3)
        .attr("height", (height_context/2))
        .attr("width", 7);
        // .resize are the handles on either size
        // of the 'window' (each is made of a set of rectangles)

    // reset date range and move handles to start
    brush.extent([dataXrange[0], dataXrange[1]]);
    brushg.call(brush);
}

export function clearGraphHighlight(brushReset = false, unique = false) {
    console.log("clearing graph highlight");

    if (unique) {
        context.selectAll('[class^="highlight-rect"').filter(function() {
            return d3.select(this).style("fill") === highlightColors["unique"];
        }).remove();
        return;
    }

    context.selectAll(".language-line").remove();
    //context.selectAll('[class^="highlight-rect"').remove();

    if (brushReset) {
        recreateBrush();
    }
        // .transition()
        // .duration(500)
        // .style("opacity", 0)
        // .each("end", function() {
        //     if (brushReset) {
        //         resetBrush();
        //     }

        //     d3.select(this).remove();
        // });
}

function clearLastSingleRectHighlight() {
    const existingRect = context.selectAll('[class^="highlight-rect"');

    if (existingRect.size() > 0) {
        existingRect[0][existingRect.size() - 1].remove();
    }
}