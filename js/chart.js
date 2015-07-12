
var symbol, granularity, margin, margin2, width, height, height2, x, x2, y, yVolume, y2, brush, candlestick, 
	volume, close, xAxis, xAxis2, yAxis, yAxis2, ohlcAnnotation, timeAnnotation, crosshair, 
	svg, focus, context, zoomable, zoomable2, zoom, rect, markers, zoom;

var parseDate = d3.time.format("%Y.%m.%d %H:%M:%S").parse;

$(document).ready(function () {
	symbol = d3.select('#symbol').on('change', load);
	granularity = d3.select('#granularity').on('change', load);
	margin = {top: 20, right: 20, bottom: 100, left: 50};
	margin2 = {top: 420, right: 20, bottom: 20, left: 50};
	width = d3.select("#chart").node().getBoundingClientRect().width - margin.left - margin.right;
	height = d3.select("#chart").node().getBoundingClientRect().height - margin.top - margin.bottom;
	height2 = d3.select("#chart").node().getBoundingClientRect().height - margin2.top - margin2.bottom;	

	load();
});

function load() {
	x = techan.scale.financetime()
			.range([0, width]);

	x2 = techan.scale.financetime() // for zoom chart
			.range([0, width]);

	y = d3.scale.linear()
			.range([height, 0]);

	yVolume = d3.scale.linear()
			.range([y(0), y(0.3)]); // only do 30% of the y-range so volume stays near the bottom of the chart

	y2 = d3.scale.linear()
			.range([height2, 0]); // for zoom chart

	brush = d3.svg.brush()
			.on("brushend", draw);

	candlestick = techan.plot.candlestick()
			.xScale(x)
			.yScale(y);

	volume = techan.plot.volume()
			.xScale(x)
			.yScale(yVolume);

	close = techan.plot.close()
			.xScale(x2)
			.yScale(y2);

	xAxis = d3.svg.axis()
			.scale(x)
			.orient("bottom");

	xAxis2 = d3.svg.axis()
			.scale(x2)
			.orient("bottom");

	yAxis = d3.svg.axis()
			.scale(y)
			.orient("left");

	yAxis2 = d3.svg.axis()
			.scale(y2)
			.ticks(0)
			.orient("left");

	ohlcAnnotation = techan.plot.axisannotation()
			.axis(yAxis)
			.format(d3.format(',.5fs'));

	timeAnnotation = techan.plot.axisannotation()
			.axis(xAxis)
			.format(d3.time.format('%Y-%m-%d'))
			.width(65)
			.translate([0, height]);
			
	zoom = d3.behavior.zoom()
        .x(x)
        .scaleExtent([0.5, 500])
//        .on('zoom', zoomed)
        .on('zoomend', draw);

	//crosshair = techan.plot.crosshair()
	//		.xScale(x)
	//		.yScale(y)
	//		.xAnnotation(timeAnnotation)
	//		.yAnnotation(ohlcAnnotation);
			
	//tooltip = d3.tip()
	//	.attr('class', 'd3-tip')
	//	.offset([-10, 0])
	//	.html(function(d) {
	//		return "<strong>Frequency:</strong> <span style='color:red'>" + d.frequency + "</span>";
	//	});

	if (svg) svg.remove(); // clear our previous contents if any
	svg = d3.select("#chart").append("svg")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom);

	focus = svg.append("g")
			.attr("class", "focus")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	focus.append("clipPath")
			.attr("id", "clip")
		.append("rect")
			.attr("x", 0)
			.attr("y", y(1))
			.attr("width", width)
			.attr("height", y(0) - y(1));

	focus.append("g")
			.attr("class", "volume")
			.attr("clip-path", "url(#clip)");

	focus.append("g")
			.attr("class", "candlestick")
			.attr("clip-path", "url(#clip)");
			
	focus.append("g")
			.attr("class", "marker")
			.attr("clip-path", "url(#clip)");

	focus.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + height + ")");

	focus.append("g")
			.attr("class", "y axis")
			.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", 6)
			.attr("dy", ".71em")
			.style("text-anchor", "end")
			.text("Price ($)"); 

	//focus.append('g')
	//		.attr("class", "crosshair")
	//		.call(crosshair);

	context = svg.append("g")
			.attr("class", "context")
			.attr("transform", "translate(" + margin2.left + "," + margin2.top + ")");

	context.append("g")
			.attr("class", "close");

	context.append("g")
			.attr("class", "pane");

	context.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + height2 + ")");

	context.append("g")
			.attr("class", "y axis")
			.call(yAxis2);

	d3.json("data/"+symbol.node().value+"_"+granularity.node().value+".json", function(error, data) {
		if (error) {
			return alert(error);
		}
		var accessor = candlestick.accessor(),
			timestart = Date.now();

		data = data.slice(0,5000).map(function(d) {
			return {
				date: parseDate(d.timestamp),
				open: +d.open,
				high: +d.high,	
				low: +d.low,
				low: +d.low,
				close: +d.close,
				volume: +d.volume
			};
		}).sort(function(a, b) { return d3.ascending(accessor.d(a), accessor.d(b)); });

		x.domain(data.map(accessor.d));
		x2.domain(x.domain());
		y.domain(techan.scale.plot.ohlc(data, accessor).domain());
		y2.domain(y.domain());
		yVolume.domain(techan.scale.plot.volume(data).domain());
		
		focus.select("g.candlestick").datum(data);
		focus.select("g.volume").datum(data);
		focus.select("g.marker").datum(data);
		
		context.select("g.close").datum(data).call(close);
		context.select("g.x.axis").call(xAxis2);

		// Associate the brush with the scale and render the brush only AFTER a domain has been applied
		zoomable = x.zoomable();
		zoomable2 = x2.zoomable();
		var domain = zoomable2.domain();
		brush.x(zoomable2);
		context.select("g.pane").call(brush).selectAll("rect").attr("height", height2);

		draw();

		console.log("Render time: " + (Date.now()-timestart));
	})
}

function draw() {
	var candlestickSelection = focus.select("g.candlestick"),
		data = candlestickSelection.datum();
	var domain = brush.empty() ? [zoomable2.domain()[1]-100,zoomable2.domain()[1]] : brush.extent();
	zoomable.domain(domain);
	y.domain(techan.scale.plot.ohlc(data.slice.apply(data, zoomable.domain()), candlestick.accessor()).domain());
	candlestickSelection.call(candlestick);
	focus.select("g.volume").call(volume);
	
	// using refresh method is more efficient as it does not perform any data joins
	// Use this if underlying data is not changing
	//svg.select("g.candlestick").call(candlestick.refresh);

	focus.select("g.x.axis").call(xAxis);
	focus.select("g.y.axis").call(yAxis);
}