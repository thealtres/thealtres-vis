// set the dimensions and margins of the graph
var margin = {top: 10, right: 50, bottom: 80, left: 30},
    width = 360 - margin.left - margin.right,
    height = 320 - margin.top - margin.bottom;

export function setChart() {
    // append the svg object to the body of the page
    var svg = d3.select("#chart")
    .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // Read the data
    d3.csv("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/data_connectedscatter.csv", function(error, data) {

        // List of groups (here I have one group per column)
        var allGroup = ["valueA", "valueB", "valueC"];

        // Add the options to the button
        d3.select("#selectButton")
        .selectAll('myOptions')
            .data(allGroup)
        .enter()
            .append('option')
        .text(function (d) { return d; }) // text showed in the menu
        .attr("value", function (d) { return d; }); // corresponding value returned by the button

        // A color scale: one color for each group
        var myColor = d3.scale.ordinal()
        .domain(allGroup)
        .range(d3.scale.category10().range());

        // Add X axis --> it is a date format
        var x = d3.scale.linear()
        .domain([0, 10])
        .range([0, width]);
        svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.svg.axis().scale(x).orient("bottom"));

        // Add Y axis
        var y = d3.scale.linear()
        .domain([0, 20])
        .range([height, 0]);
        svg.append("g")
        .call(d3.svg.axis().scale(y).orient("left"));

        // Initialize line with group a
        var line = svg
        .append('g')
        .append("path")
            .datum(data)
            .attr("d", d3.svg.line()
            .x(function(d) { return x(+d.time); })
            .y(function(d) { return y(+d.valueA); })
            )
            .attr("stroke", function(d){ return myColor("valueA"); })
            .style("stroke-width", 4)
            .style("fill", "none");

        // A function that updates the chart
        function update(selectedGroup) {

        // Create new data with the selection
        var dataFilter = data.map(function(d){return {time: d.time, value:d[selectedGroup]} });

        // Give these new data to update line
        line
            .datum(dataFilter)
            .transition()
            .duration(1000)
            .attr("d", d3.svg.line()
                .x(function(d) { return x(+d.time); })
                .y(function(d) { return y(+d.value); })
            )
            .attr("stroke", function(d){ return myColor(selectedGroup); });
        }

        // When the button is changed, run the updateChart function
        d3.select("#selectButton").on("change", function() {
            // Recover the option that has been chosen
            var selectedOption = d3.select(this).property("value");
            // Run the updateChart function with this selected option
            update(selectedOption);
        });
    });
}