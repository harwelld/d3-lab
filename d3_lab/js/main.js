/*   d3-lab main.js - Dylan Harwell - UW Madison    */
(function(){
    
    //data join variables
    var attrArray = ["TotalPop", "Owner_HU", "Renter_HU", "Males_20s", "Females_20", "TotalCrimes18"];
    var expressed = attrArray[0];
    
    //create new svg container for the map
    var map = d3.select("#map")
        .append("svg")
        .attr("class", "map")
        .attr("height", 500);
    
    //chart sizing variables
    var chartWidth = window.innerWidth * 0.65,
        chartHeight = 425,
        leftPadding = 50,
        rightPadding = 2,
        topBottomPadding = -6,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding*2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
    
    //create a second svg element to hold the bar chart
    var chart = d3.select("#chart")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    window.onload = setMap(map);

    //set up map
    function setMap(map){
        console.log('called');
        d3.queue()
            .defer(d3.csv, "data/Census2010.csv") //load attributes from csv
            .defer(d3.json, "data/neighborhoods3.topojson") //load spatial data
            .await(callback);

        function callback(error, csvData, Neighborhoods){
            var pdx_neighborhoods = topojson.feature(Neighborhoods,                                                           Neighborhoods.objects.neighborhoods3).features;

            //create Albers equal area conic projection centered on Portland
            var projection = d3.geoAlbers()
                .center([-2.53, 45.5465])
                .rotate([120, 0, 0])
                .scale(110000);
            var path = d3.geoPath()
                .projection(projection);

            //create a scale to size bars proportionally to frame
            var maxValue = getMax(csvData, expressed);
            maxValue = maxValue + maxValue*.01;
            //console.log(expressed);
            var yScale = d3.scaleLinear()
                .range([425, 0])
                .domain([0, maxValue]);
            
            //create vertical axis generator
            var yAxis = d3.axisLeft()
                .scale(yScale)
            
            //join csv data to neighborhoods feature
            pdx_neighborhoods = joinData(pdx_neighborhoods, csvData);
            
            //create color ramp
            colorScale = makeColorScale(csvData);
            
            //add enumeration units to map
            setEnumerationUnits(pdx_neighborhoods, map, path, colorScale);
            
            //add coordinated visualization to the map
            setChart(chart, csvData, colorScale, yScale, yAxis);
            
            //create dropdown menu
            createDropdown(csvData);
        }
    }
    
    //function to join csv data to neighborhoods feature
    function joinData(Neighborhoods, csvData){
        for (var i=0; i<csvData.length; i++){
            var csvNeighborhood = csvData[i]; //the current neighborhood
            var csvKey = csvNeighborhood.Neighborhood; //the CSV primary key
            for (var a=0; a<Neighborhoods.length; a++){
                var geojsonProps = Neighborhoods[a].properties;
                var geojsonKey = geojsonProps.MAPLABEL; //the geojson primary key
                if (geojsonKey == csvKey){
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvNeighborhood[attr]);
                        geojsonProps[attr] = val;
                    });
                }
            }
        }
        return Neighborhoods;
    }
    
    //function to get max attribute value
    function getMax(csvData, expressed){
        var values = [];
        for (var i=0; i<csvData.length; i++){
            var csvNeighborhood = csvData[i];
            var value = csvNeighborhood[expressed];
            values.push(value)
        }
        return Math.max(...values);
    }
    
    //enumeration units function
    function setEnumerationUnits(Neighborhoods, map, path, colorScale){
        var neighborhoods = map.selectAll(".neighborhood")
            .data(Neighborhoods)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "neighborhood " + d.properties.MAPLABEL;
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale);
            });
    }
    
    //function to test for data value and return color
    function choropleth(properties, colorScale){
        //make sure attribute value is a number
        var val = parseFloat(properties[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "#CCC";
        }
    }
    
    //function to create color scale generator
    function makeColorScale(data){
        var colorClasses = [
            "#D4B9DA",
            "#C994C7",
            "#DF65B0",
            "#DD1C77",
            "#980043"
        ];

        //create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        }

        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });
        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);

        return colorScale;
    }
    
    //function to create coordinated bar chart
    function setChart(chart, csvData, colorScale, yScale, yAxis){
        var bars = chart.selectAll(".bars")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return b[expressed]-a[expressed]
            })
            .attr("class", function(d){
                return "bars " + d.Neighborhood;
            })
            .attr("width", chartInnerWidth / csvData.length - 1);

        //create chart title
        var chartTitle = chart.append("text")
            .attr("x", 500)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text(expressed + " By Neighborhood");

        //add y-axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);
        
        //set bars
        createChart(bars, csvData.length, colorScale, yScale);
    }
    
    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData){
        var dropdown = d3.select("#map")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData)
            });

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });
    }
    
    //Example 1.4 line 14...dropdown change listener handler
    function changeAttribute(attribute, csvData){
        //change the expressed attribute
        expressed = attribute;
        console.log(expressed);
        maxValue = getMax(csvData, expressed);

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var neighborhoods = d3.selectAll(".neighborhood")
            .style("fill", function(d){
                return choropleth(d.properties, colorScale)
            });
        
        //re-sort, resize, and recolor bars
        var bars = d3.selectAll(".bars")
            .sort(function(a, b){
                return b[expressed] - a[expressed];
            });
        
        var yScale = d3.scaleLinear()
            .range([425, 0])
            .domain([0, maxValue]);
            
        //create vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale)
        
        //set bars
        updateChart(expressed, bars, csvData.length, colorScale, yAxis, yScale);
    }
    
    //function to position, size, and color bars in chart
    function updateChart(expressed, bars, n, colorScale, yAxis, yScale){
        bars.attr("x", function(d, i){
                return i * (chartInnerWidth / n) + leftPadding;
            })
            //resize bars
            .attr("height", function(d, i){
                return chartHeight - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //recolor bars
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });
        
        d3.select("g")
            .attr("transform", translate)
            .transition().duration(2000)
            .call(yAxis);
    }
    
    //create initial chart
    function createChart(bars, n, colorScale, yScale){
        bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
            })
            //resize bars
            .attr("height", function(d, i){
                return chartHeight - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //recolor bars
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });
    }
    
})();