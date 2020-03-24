//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    //map frame dimensions
    var width = 960,
        height = 460;

    //create new svg container for the map
    var map = d3.select("#map")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoAlbers()
        .center([0, 46.2])
        .rotate([-2, 0, 0])
        .parallels([43, 62])
        .scale(2500)
        .translate([width / 2, height / 2]);
    
    var path = d3.geoPath()
        .projection(projection);
    
    //use queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/Census2010.csv") //load attributes from csv
        .defer(d3.json, "data/neighborhoods3.topojson") //load spatial data
        .await(callback);

    //Example 1.5 line 1
    function callback(error, csvData, Neighborhoods){
        var pdx_neighborhoods = topojson.feature(Neighborhoods, Neighborhoods.objects.Neighborhoods).features;

        //add portland neighborhoods to map
        var regions = map.selectAll(".regions")
            .data(pdx_neighborhoods)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "regions " + d.properties.MAPLABEL;
            })
            .attr("d", path);
    };
}