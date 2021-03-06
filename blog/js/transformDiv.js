define([
    'd3',
    'components/sl',
    'MockData',
    //'utils/tickWidth',
    'moment',
    'moment-range',
    'components/candlestickSeries'
], function (d3, sl, MockData, /*tickWidth,*/ moment) {
    'use strict';

	var w = window,
        d = document,
        e = d.documentElement,
        g = d.getElementsByTagName('body')[0],
        windowWidth = w.innerWidth || e.clientWidth || g.clientWidth,
        windowHeight = w.innerHeight|| e.clientHeight|| g.clientHeight;

    var margin = {top: 20, right: 20, bottom: 30, left: 50},
        width = windowWidth - margin.left - margin.right - 25,
        height = windowHeight - margin.top - margin.bottom - 50;

    var xScale = d3.time.scale(),
        yScale = d3.scale.linear();

    var oldScale;

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .ticks(5);

    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient('left');

    var candles = sl.series.candlestick()
        .xScale(xScale)
        .yScale(yScale);

    var sma = d3.svg.line()
        .x(function(d) { return xScale(d.date); })
        .y(function(d) { return yScale(d.sma); });

    var zoom = d3.behavior.zoom()
        .x(xScale)
        .scaleExtent([0.5, 500])
        .on('zoom', zoomed)
        .on('zoomend', zoomend);

	var parseDate = d3.time.format("%Y.%m.%d %H:%M:%S").parse;

	var symbol = d3.select("#symbol")
			.on("change", load);
	var granularity = d3.select("#granularity")
			.on("change", load);

	function granularityToSeconds() {
		switch (granularity.node().value) {
			case "1m":
				return 60;
			case "5m":
				return 300;
			case "30m":
				return 1800;
			case "1h":
				return 3600;
			case "1d":
				return 86400;
		}
	}

	function rectangleWidth() {
        var scaleRange = xScale.range();
		var domain = xScale.domain();
		var seconds = Math.abs(domain[1].getTime() - domain[0].getTime()) / 1000;
		var numCandles = seconds / granularityToSeconds();
        return (scaleRange[1] - scaleRange[0]) / (numCandles * 2.5);
    };

	function load() {
		d3.json("/data/" + symbol.node().value + "_" + granularity.node().value + ".json", function(error, jsonData) {
			if (error) {
				return alert(error);
			}

            d3.select('#chart').selectAll("svg").remove();
            d3.select("#series-clip").remove();

            var clipDiv = d3.select('#chart').classed('chart', true).append('div')
                .attr('id', 'series-clip')
                .style('position', 'absolute')
                .style('overflow', 'hidden')
                .style('top', margin.top + 'px')
                .style('left', margin.left + 'px');

            var seriesDiv = clipDiv.append('div')
                .attr('id', 'series-container');

            var svg = d3.select('#chart').append('svg')
                .style('position', 'absolute')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom);
        		/*
        	   //responsive SVG needs these 2 attributes and no width and height attr
        	   .attr("preserveAspectRatio", "xMinYMin meet")
        	   .attr("viewBox", "0 0 1000 575")
        	   //class to make it responsive
        	   .classed("svg-content-responsive", true);
        	   */

            var seriesSvg = seriesDiv.append('svg')
                .attr('width', width)
                .attr('height', height);

            // Ceate chart
            var g = svg.append('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            // Create plot area
            var plotArea = g.append('g');
            plotArea.append('clipPath')
                .attr('id', 'plotAreaClip')
                .append('rect')
                .attr({ width: width, height: height });
            plotArea.attr('clip-path', 'url(#plotAreaClip)');

            plotArea.append('rect')
                .attr('class', 'zoom-pane')
                .attr('width', width)
                .attr('height', height)
                .call(zoom);

            var smaValues = [];
			data = jsonData.slice(0,5000).map(function(d) {
                if (smaValues.length == 5)
                    smaValues.shift();
                smaValues.push(d.close);
                var sum = 0;
                for (var i = 0; i < smaValues.length; i++)
                    sum += smaValues[i];
				return {
					date: parseDate(d.timestamp),
					open: +d.open,
					high: +d.high,
					low: +d.low,
					close: +d.close,
					volume: +d.volume,
                    sma: +(sum / smaValues.length)
				};
			});

			// Set scale domains
            xScale.range(
                [
                    d3.min(data, function (d) {
                        return d.low;
                    }),
                    d3.max(data, function (d) {
                        return d.high;
                    })
                ]
            );
            var dataSlice = data.slice(data.length-150,data.length); // try to zoom to most recent 100 bars
			xScale.domain(d3.extent(dataSlice, function (d) {
				return d.date;
			}));

			yScale.domain(
				[
					d3.min(dataSlice, function (d) {
						return d.low;
					}),
					d3.max(dataSlice, function (d) {
						return d.high;
					})
				]
			);

			// Set scale ranges
			xScale.range([0, width]);
			yScale.range([height, 0]);

			zoom.x(xScale);
			oldScale = yScale.copy();

			// Draw axes
			g.append('g')
				.attr('class', 'x axis')
				.attr('transform', 'translate(0,' + height + ')')
				.call(xAxis);

			g.append('g')
				.attr('class', 'y axis')
				.call(yAxis);

			// Draw candlesticks
			candles.rectangleWidth(rectangleWidth());
			seriesSvg.append('g')
				.attr('class', 'series')
				.datum(data)
				.call(candles);

            // Draw sma
            seriesSvg.append("path")
                .attr("class", "sma")
                .attr("d", sma(data));

		});
	}

    function zoomed() {

        var yTransformTranslate = 0,
            yTransformScale,
            xTransformTranslate = d3.event.translate[0],
            xTransformScale = d3.event.scale;

        var xDomain = xScale.domain();
        var range = moment().range(xDomain[0], xDomain[1]);
        var rangeData = [];

        var oldDomain = oldScale.domain();

        var g = d3.selectAll('svg').select('g');
        var seriesDiv = d3.selectAll('#series-container');
        var transform;

        for (var i = 0; i < data.length; i += 1) {
            if (range.contains(data[i].date)) {
                rangeData.push(data[i]);
            }
        }

        yScale.domain(
            [
                d3.min(rangeData, function (d) {
                    return d.low;
                }),
                d3.max(rangeData, function (d) {
                    return d.high;
                })
            ]
        );

        g.select('.x.axis')
            .call(xAxis);

        g.select('.y.axis')
            .call(yAxis);

        yTransformScale = (oldDomain[1] - oldDomain[0]) / (yScale.domain()[1] - yScale.domain()[0]);

        if (yScale.domain()[1] !== oldDomain[1]) {
            yTransformTranslate = oldScale(oldDomain[1]) - oldScale(yScale.domain()[1]) ;
            yTransformTranslate *= yTransformScale;
        }

        seriesDiv = document.getElementById('series-container');

        transform = 'translate3d(' + xTransformTranslate + 'px,' + yTransformTranslate  + 'px, 0px) scale3d(' + xTransformScale + ',' + yTransformScale + ', 1)';
        seriesDiv.style.webkitTransform = transform;
        seriesDiv.style.webkitTransformOrigin = "0 0";
        seriesDiv.style.MozTransform = transform;
        seriesDiv.style.MozTransformOrigin = "0 0";

    }

    function zoomend() {
        var xDomain = xScale.domain();
        var seriesDiv = d3.select('#series-container');
        var nullTransform =  'translate3d(0,0,0) scale3d(1,1,1)';

        oldScale = yScale.copy();

        zoom.x(xScale);
        candles.rectangleWidth(rectangleWidth());

        seriesDiv.select('.series')
            .call(candles);

        seriesDiv.select('.sma')
            .attr('d', sma(data));

        seriesDiv = document.getElementById('series-container');
        seriesDiv.style.webkitTransform = nullTransform;
        seriesDiv.style.MozTransform = nullTransform;
    }

    load();
});
